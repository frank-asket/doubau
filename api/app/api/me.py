from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import desc, func, select

from app.agents.fit_score import FitScoreError, FitScoreOut, compute_fit_score_from_jd_text
from app.api.deps import CurrentUserDep, DbDep
from app.api.jobs import FeedOut
from app.api.jobs import feed as jobs_personalized_feed
from app.api.schemas import (
    CheckInCreate,
    CheckInOut,
    DashboardSummaryOut,
    DashboardTrendPoint,
    HeroApplicationTrendsOut,
    HeroCareerGoalOut,
    HeroDashboardOut,
    HeroMetricsBundleOut,
    HeroScoreMetricOut,
    HeroSubscriptionOut,
    HeroTopPickOut,
    HeroTrendBucketOut,
    JdFitRequest,
    MilestoneCreate,
    MilestoneOut,
    MilestonePatch,
    ProfileOut,
    ProfileUpsert,
    WorkspaceSummaryOut,
)
from app.core.settings import settings
from app.models.application import Application, ApplicationStatus
from app.models.check_in import CheckIn
from app.models.job_match_event import JobMatchEvent
from app.models.milestone import Milestone
from app.models.profile import Profile
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user import User
from app.services.hero_dashboard import compute_hero_dashboard_payload
from app.storage.s3 import ensure_bucket, s3_client
from app.tasks import process_resume_document, run_process_resume_document_sync

router = APIRouter(prefix="/me", tags=["me"])
log = logging.getLogger(__name__)


class AccountDeleteOut(BaseModel):
    status: str
    deleted_user_id: UUID
    deleted_resume_objects: int
    deleted_resume_documents: int


async def _resume_pipeline_background(resume_document_id: str) -> None:
    """Runs parse/embed off the request thread so POST /me/resume returns quickly."""
    try:
        await asyncio.to_thread(run_process_resume_document_sync, resume_document_id)
    except Exception:
        log.exception("Résumé pipeline failed document_id=%s", resume_document_id)


def _resume_document_out(doc: ResumeDocument) -> dict:
    emb_dims: int | None = None
    if isinstance(doc.embedding, list):
        emb_dims = len(doc.embedding)
    elif doc.embedding_vector is not None:
        emb_dims = len(doc.embedding_vector)

    return {
        "id": str(doc.id),
        "status": doc.status,
        "file_name": doc.file_name,
        "content_type": doc.content_type,
        "size_bytes": doc.size_bytes,
        "error": doc.error,
        "parsed_json": doc.parsed_json,
        "extracted_text": doc.extracted_text,
        "embedding_model": doc.embedding_model,
        "embedding_dimensions": emb_dims,
    }


@router.get("/profile", response_model=ProfileOut)
def get_profile(current_user: CurrentUserDep) -> ProfileOut:
    profile = current_user.profile
    return ProfileOut(
        email=current_user.email,
        current_role=profile.current_role if profile else None,
        years_experience=profile.years_experience if profile else None,
        persona=profile.persona if profile else None,
        location=profile.location if profile else None,
        contact_preferences=profile.contact_preferences if profile else None,
        goals=profile.goals if profile else None,
        plan_tier=profile.plan_tier if profile else None,
    )


@router.put("/profile", response_model=ProfileOut)
def put_profile(
    payload: ProfileUpsert,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ProfileOut:
    profile = current_user.profile
    if profile is None:
        profile = Profile(user_id=current_user.id, goals={})
        db.add(profile)

    if payload.current_role is not None:
        profile.current_role = payload.current_role
    if payload.years_experience is not None:
        profile.years_experience = payload.years_experience
    if payload.persona is not None:
        profile.persona = payload.persona
    if payload.location is not None:
        profile.location = payload.location
    if payload.contact_preferences is not None:
        profile.contact_preferences = payload.contact_preferences
    if payload.goals is not None:
        profile.goals = payload.goals
    if payload.plan_tier is not None:
        profile.plan_tier = payload.plan_tier

    db.commit()
    db.refresh(profile)

    return ProfileOut(
        email=current_user.email,
        current_role=profile.current_role,
        years_experience=profile.years_experience,
        persona=profile.persona,
        location=profile.location,
        contact_preferences=profile.contact_preferences,
        goals=profile.goals,
        plan_tier=profile.plan_tier,
    )


@router.post("/resume", response_model=dict)
async def upload_resume(
    db: DbDep,
    current_user: CurrentUserDep,
    background_tasks: BackgroundTasks,
    file: UploadFile,
) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    content_type = file.content_type or ""
    allowed = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    if content_type and content_type not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 10MB)")

    bucket = settings.s3_bucket_resumes
    prefix = settings.s3_resume_object_prefix
    key = f"{prefix}/{current_user.id}/{uuid4()}-{file.filename}"

    try:
        client = s3_client()
        ensure_bucket(client, bucket)
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=raw,
            ContentType=content_type or "application/octet-stream",
        )
    except (ClientError, BotoCoreError) as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    doc = ResumeDocument(
        user_id=current_user.id,
        status=ResumeStatus.UPLOADED,
        file_name=file.filename,
        content_type=content_type or None,
        size_bytes=len(raw),
        s3_bucket=bucket,
        s3_key=key,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    if settings.resume_process_via_celery:
        process_resume_document.delay(str(doc.id))
    else:
        background_tasks.add_task(_resume_pipeline_background, str(doc.id))
    return {
        "id": str(doc.id),
        "status": doc.status,
        "s3_bucket": doc.s3_bucket,
        "s3_key": doc.s3_key,
    }


@router.get("/resume/latest", response_model=dict)
def get_resume_latest(
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    """Most recently uploaded résumé for the current user (by `created_at`)."""
    doc = (
        db.execute(
            select(ResumeDocument)
            .where(ResumeDocument.user_id == current_user.id)
            .order_by(desc(ResumeDocument.created_at))
            .limit(1)
        )
        .scalars()
        .one_or_none()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="No resume uploaded yet")

    return _resume_document_out(doc)


@router.get("/resume/{resume_document_id}", response_model=dict)
def get_resume(
    resume_document_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> dict:
    doc = (
        db.execute(
            select(ResumeDocument).where(
                ResumeDocument.id == resume_document_id,
                ResumeDocument.user_id == current_user.id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Not found")

    return _resume_document_out(doc)


@router.get("/match/events", response_model=list[dict])
def list_match_events(
    db: DbDep,
    current_user: CurrentUserDep,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    rows = db.execute(
        select(JobMatchEvent)
        .where(JobMatchEvent.user_id == current_user.id)
        .order_by(desc(JobMatchEvent.created_at))
        .limit(limit)
        .offset(offset)
    ).scalars()
    out: list[dict] = []
    for ev in rows:
        out.append(
            {
                "id": str(ev.id),
                "job_id": str(ev.job_id),
                "event_type": ev.event_type,
                "reason": ev.reason,
                "meta": ev.meta,
                "created_at": ev.created_at,
            }
        )
    return out


@router.get("/match/metrics", response_model=dict)
def match_metrics(
    db: DbDep,
    current_user: CurrentUserDep,
    days: int = 14,
) -> dict:
    days = max(1, min(days, 90))
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = db.execute(
        select(
            JobMatchEvent.event_type,
            JobMatchEvent.reason,
            func.count().label("n"),
        )
        .where(JobMatchEvent.user_id == current_user.id)
        .where(JobMatchEvent.created_at >= cutoff)
        .group_by(JobMatchEvent.event_type, JobMatchEvent.reason)
        .order_by(desc(func.count()))
    ).all()
    by_event: dict[str, int] = {}
    by_reason: dict[str, int] = {}
    for event_type, reason, n in rows:
        by_event[str(event_type)] = by_event.get(str(event_type), 0) + int(n)
        if reason:
            by_reason[str(reason)] = by_reason.get(str(reason), 0) + int(n)
    return {"window_days": days, "by_event_type": by_event, "by_reason": by_reason}


@router.get("/workspace-summary", response_model=WorkspaceSummaryOut)
def workspace_summary(db: DbDep, current_user: CurrentUserDep) -> WorkspaceSummaryOut:
    profile = current_user.profile
    latest = db.scalar(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == current_user.id)
        .order_by(desc(ResumeDocument.created_at))
        .limit(1)
    )
    resume_status = latest.status if latest else None
    resume_id = str(latest.id) if latest else None

    rows = db.execute(
        select(Application.status, func.count())
        .where(Application.user_id == current_user.id)
        .group_by(Application.status)
    ).all()
    by_status: dict[str, int] = {}
    total = 0
    for st, n in rows:
        key = st.value if hasattr(st, "value") else str(st)
        by_status[key] = int(n)
        total += int(n)

    pending = db.scalar(
        select(func.count())
        .select_from(Application)
        .where(Application.user_id == current_user.id)
        .where(Application.status == ApplicationStatus.PENDING_APPROVAL)
    )
    pending_n = int(pending or 0)

    return WorkspaceSummaryOut(
        email=current_user.email,
        persona=profile.persona if profile else None,
        current_role=profile.current_role if profile else None,
        location=profile.location if profile else None,
        plan_tier=profile.plan_tier if profile else None,
        resume_status=resume_status,
        resume_id=resume_id,
        applications_total=total,
        applications_by_status=by_status,
        pending_approval_count=pending_n,
    )


def _resume_readiness(status: str | None) -> int:
    if status == ResumeStatus.EMBEDDED:
        return 100
    if status == ResumeStatus.PARSED:
        return 72
    if status == ResumeStatus.UPLOADED:
        return 40
    if status == ResumeStatus.FAILED:
        return 12
    return 0


@router.delete("/account", response_model=AccountDeleteOut)
def delete_account(db: DbDep, current_user: CurrentUserDep) -> AccountDeleteOut:
    """Erase the current user's app account and résumé objects.

    Database rows use ON DELETE CASCADE from ``users`` for profile, applications/drafts,
    check-ins, milestones, match events, feedback, idempotency keys, LLM logs, and Copilot
    sessions. S3 objects are deleted first so failures do not leave orphaned database state.
    """
    docs = db.scalars(
        select(ResumeDocument).where(ResumeDocument.user_id == current_user.id)
    ).all()
    objects = [(d.s3_bucket, d.s3_key) for d in docs if d.s3_bucket and d.s3_key]

    if objects:
        client = s3_client()
        for bucket, key in objects:
            try:
                client.delete_object(Bucket=bucket, Key=key)
            except ClientError as e:
                code = (e.response or {}).get("Error", {}).get("Code")
                if str(code) not in {"404", "NoSuchKey", "NotFound"}:
                    raise HTTPException(
                        status_code=502,
                        detail="Could not delete résumé storage.",
                    ) from e
            except BotoCoreError as e:
                raise HTTPException(
                    status_code=502,
                    detail="Could not delete résumé storage.",
                ) from e

    deleted_user_id = current_user.id
    deleted_resume_documents = len(docs)
    user = db.get(User, current_user.id)
    if user is None:
        raise HTTPException(status_code=404, detail="Account not found")

    db.delete(user)
    db.commit()
    return AccountDeleteOut(
        status="deleted",
        deleted_user_id=deleted_user_id,
        deleted_resume_objects=len(objects),
        deleted_resume_documents=deleted_resume_documents,
    )


def _trend_bucket(dt: datetime, *, start: datetime) -> int:
    return max(0, min(7, int((dt - start).days // 4)))


@router.get("/dashboard-summary", response_model=DashboardSummaryOut)
def dashboard_summary(db: DbDep, current_user: CurrentUserDep) -> DashboardSummaryOut:
    base = workspace_summary(db, current_user)
    now = datetime.utcnow()
    start = now - timedelta(days=31)
    labels = ["1-4", "5-8", "9-12", "13-16", "17-20", "21-24", "25-28", "29-31"]
    trend = [DashboardTrendPoint(label=label) for label in labels]

    apps = db.scalars(
        select(Application)
        .where(Application.user_id == current_user.id)
        .where(Application.created_at >= start)
        .order_by(Application.created_at.asc())
    ).all()
    for app in apps:
        bucket = trend[_trend_bucket(app.created_at.replace(tzinfo=None), start=start)]
        status = app.status.value if hasattr(app.status, "value") else str(app.status)
        if status in (
            ApplicationStatus.DISCOVERED,
            ApplicationStatus.SCORING,
            ApplicationStatus.DRAFTED,
        ):
            bucket.discovered += 1
        elif status in (ApplicationStatus.PENDING_APPROVAL, ApplicationStatus.APPROVED):
            bucket.pending += 1
        elif status == ApplicationStatus.SUBMITTED:
            bucket.submitted += 1
        elif status in (ApplicationStatus.FAILED, ApplicationStatus.RETRY):
            bucket.failed += 1

    recent = db.scalars(
        select(Application)
        .where(Application.user_id == current_user.id)
        .order_by(desc(Application.updated_at), desc(Application.created_at))
        .limit(5)
    ).all()

    return DashboardSummaryOut(
        **base.model_dump(),
        resume_readiness=_resume_readiness(base.resume_status),
        applications_trend=trend,
        recent_applications=[
            {
                "id": str(app.id),
                "company": app.company,
                "job_title": app.job_title,
                "status": app.status.value if hasattr(app.status, "value") else str(app.status),
                "source_url": app.source_url,
                "created_at": app.created_at,
                "updated_at": app.updated_at,
            }
            for app in recent
        ],
    )


def _workplace_caption(location: str | None) -> str:
    loc = (location or "").lower()
    if "remote" in loc or "anywhere" in loc or "wfh" in loc:
        return "Remote"
    if "hybrid" in loc:
        return "Hybrid"
    return "On-site"


def _seniority_caption(job_seniority: str | None, profile_years: str | None) -> str:
    s = (job_seniority or "").strip()
    if s:
        return s if "exp" in s.lower() else f"{s} experience"
    y = (profile_years or "").strip()
    if y:
        return f"{y} experience"
    return "Experience varies"


def _salary_from_tags(tags: list[str]) -> str | None:
    for raw in tags or []:
        t = str(raw).strip()
        if not t:
            continue
        lower = t.lower()
        has_k_with_digit = "k" in lower and any(c.isdigit() for c in t)
        if "£" in t or "gbp" in lower or "salary" in lower or "/yr" in lower or has_k_with_digit:
            return t
    return None


def _hero_top_picks(feed_rows: list[FeedOut], profile: Profile | None) -> list[HeroTopPickOut]:
    yrs = profile.years_experience if profile else None
    out: list[HeroTopPickOut] = []
    for row in feed_rows:
        j = row.job
        et = (j.employment_type or "").strip() or None
        out.append(
            HeroTopPickOut(
                job_id=j.id,
                title=j.title,
                company=j.company,
                seniority_caption=_seniority_caption(j.seniority, yrs),
                employment_type=et,
                workplace_caption=_workplace_caption(j.location),
                salary_caption=_salary_from_tags(j.tags),
                match_percent=int(round(max(0.0, min(100.0, row.score)))),
                source_url=j.source_url,
            )
        )
    return out


@router.get("/hero-dashboard", response_model=HeroDashboardOut)
def hero_dashboard(db: DbDep, current_user: CurrentUserDep) -> HeroDashboardOut:
    """Scores + layout data for the CareerHero-style home dashboard."""
    profile = current_user.profile
    raw = compute_hero_dashboard_payload(
        db,
        user_id=current_user.id,
        email=current_user.email,
        profile=profile,
    )
    feed_rows = jobs_personalized_feed(db=db, current_user=current_user, limit=4, offset=0)
    top = _hero_top_picks(feed_rows, profile)

    m = raw["metrics"]
    return HeroDashboardOut(
        display_name=raw["display_name"],
        subscription=HeroSubscriptionOut(**raw["subscription"]),
        metrics=HeroMetricsBundleOut(
            career_score=HeroScoreMetricOut(**m["career_score"]),
            skills_growth=HeroScoreMetricOut(**m["skills_growth"]),
            linkedin_health=HeroScoreMetricOut(**m["linkedin_health"]),
            cv_score=HeroScoreMetricOut(**m["cv_score"]),
        ),
        career_goals=[HeroCareerGoalOut(**g) for g in raw["career_goals"]],
        application_trends=HeroApplicationTrendsOut(
            buckets=[HeroTrendBucketOut(**b) for b in raw["application_trends"]["buckets"]],
            window_total=raw["application_trends"]["window_total"],
            window_delta_percent=raw["application_trends"]["window_delta_percent"],
            trend=raw["application_trends"]["trend"],
        ),
        top_picks=top,
        algorithm_version=raw["algorithm_version"],
    )


@router.post("/jd-fit", response_model=FitScoreOut)
def jd_fit(db: DbDep, current_user: CurrentUserDep, payload: JdFitRequest) -> FitScoreOut:
    resume = db.scalar(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == current_user.id)
        .where(ResumeDocument.status.in_((ResumeStatus.PARSED, ResumeStatus.EMBEDDED)))
        .order_by(desc(ResumeDocument.created_at))
        .limit(1)
    )
    if resume is None or not (resume.extracted_text or "").strip():
        raise HTTPException(status_code=400, detail="Upload and parse a résumé first.")

    text = (resume.extracted_text or "").strip()
    try:
        return compute_fit_score_from_jd_text(
            job_title=payload.job_title,
            company=payload.company,
            job_description=payload.job_description,
            resume_text=text,
        )
    except FitScoreError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(
    db: DbDep,
    current_user: CurrentUserDep,
    limit: int = 100,
) -> list[MilestoneOut]:
    limit = max(1, min(limit, 200))
    rows = db.scalars(
        select(Milestone)
        .where(Milestone.user_id == current_user.id)
        .order_by(desc(Milestone.created_at))
        .limit(limit)
    ).all()
    return [MilestoneOut.model_validate(r) for r in rows]


@router.post("/milestones", response_model=MilestoneOut)
def create_milestone(
    db: DbDep,
    current_user: CurrentUserDep,
    payload: MilestoneCreate,
) -> MilestoneOut:
    row = Milestone(
        user_id=current_user.id,
        title=payload.title.strip(),
        status=payload.status.strip() if payload.status else "todo",
        due_date=payload.due_date,
        meta=dict(payload.meta or {}),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return MilestoneOut.model_validate(row)


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def patch_milestone(
    milestone_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
    payload: MilestonePatch,
) -> MilestoneOut:
    row = db.get(Milestone, milestone_id)
    if row is None or row.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Not found")
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        row.title = str(data["title"]).strip()
    if "status" in data:
        row.status = str(data["status"]).strip()
    if "due_date" in data:
        row.due_date = data["due_date"]
    if "meta" in data and isinstance(data["meta"], dict):
        row.meta = {**(row.meta or {}), **data["meta"]}
    db.commit()
    db.refresh(row)
    return MilestoneOut.model_validate(row)


@router.get("/check-ins", response_model=list[CheckInOut])
def list_check_ins(
    db: DbDep,
    current_user: CurrentUserDep,
    limit: int = 60,
) -> list[CheckInOut]:
    limit = max(1, min(limit, 200))
    rows = db.scalars(
        select(CheckIn)
        .where(CheckIn.user_id == current_user.id)
        .order_by(desc(CheckIn.created_at))
        .limit(limit)
    ).all()
    return [CheckInOut.model_validate(r) for r in rows]


@router.post("/check-ins", response_model=CheckInOut)
def create_check_in(
    db: DbDep,
    current_user: CurrentUserDep,
    payload: CheckInCreate,
) -> CheckInOut:
    row = CheckIn(
        user_id=current_user.id,
        mood=payload.mood,
        energy=payload.energy,
        workload=payload.workload,
        notes=(
            payload.notes.strip()
            if isinstance(payload.notes, str) and payload.notes.strip()
            else None
        ),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return CheckInOut.model_validate(row)
