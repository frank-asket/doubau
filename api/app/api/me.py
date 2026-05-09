from datetime import datetime, timedelta
from uuid import UUID, uuid4

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, UploadFile
from sqlalchemy import desc, func, select

from app.api.deps import CurrentUserDep, DbDep
from app.api.schemas import ProfileOut, ProfileUpsert
from app.core.settings import settings
from app.models.profile import Profile
from app.models.job_match_event import JobMatchEvent
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.storage.s3 import ensure_bucket, s3_client
from app.tasks import process_resume_document

router = APIRouter(prefix="/me", tags=["me"])


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

    process_resume_document.delay(str(doc.id))
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

