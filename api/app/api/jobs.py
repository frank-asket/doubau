from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agents.fit_score import FitScoreError, FitScoreOut, compute_fit_score
from app.api.deps import CurrentUserDep, DbDep
from app.core.settings import settings
from app.jobs.url_hash import hash_source_url
from app.models.job import Job
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.tasks import embed_job as embed_job_task
from app.tasks import ingest_adzuna_jobs as ingest_adzuna_jobs_task
from app.tasks import ingest_remoteok_jobs as ingest_remoteok_jobs_task
from app.tasks import scrape_job as scrape_job_task
from app.tasks import scrape_rss_feed as scrape_rss_feed_task

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=220)
    location: str | None = Field(default=None, max_length=220)
    seniority: str | None = Field(default=None, max_length=80)
    employment_type: str | None = Field(default=None, max_length=80)
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    source_url: str | None = Field(default=None, max_length=1000)
    listing_source: str | None = Field(default=None, max_length=80)


class JobOut(BaseModel):
    id: UUID
    company: str
    title: str
    location: str | None
    seniority: str | None
    employment_type: str | None
    description: str | None
    tags: list[str]
    source_url: str | None
    listing_source: str | None = None
    source_posted_at: datetime | None = None
    created_at: datetime


def _job_out(j: Job) -> JobOut:
    return JobOut(
        id=j.id,
        company=j.company,
        title=j.title,
        location=j.location,
        seniority=j.seniority,
        employment_type=j.employment_type,
        description=j.description,
        tags=j.tags or [],
        source_url=j.source_url,
        listing_source=j.listing_source,
        source_posted_at=j.source_posted_at,
        created_at=j.created_at,
    )


@router.post("", response_model=JobOut)
def create_job(payload: JobCreate, db: DbDep, _: CurrentUserDep) -> JobOut:
    url_hash = hash_source_url(payload.source_url) if payload.source_url else None
    if url_hash:
        existing = db.scalar(select(Job).where(Job.source_url_hash == url_hash))
        if existing is not None:
            return _job_out(existing)

    job = Job(
        company=payload.company,
        title=payload.title,
        location=payload.location,
        seniority=payload.seniority,
        employment_type=payload.employment_type,
        description=payload.description,
        tags=payload.tags,
        source_url=payload.source_url,
        source_url_hash=url_hash,
        listing_source=payload.listing_source,
    )
    db.add(job)
    try:
        db.commit()
        db.refresh(job)
    except IntegrityError:
        db.rollback()
        if url_hash is None:
            raise
        existing = db.scalar(select(Job).where(Job.source_url_hash == url_hash))
        if existing is not None:
            return _job_out(existing)
        raise

    if settings.openai_api_key:
        embed_job_task.delay(str(job.id))

    return _job_out(job)


@router.get("", response_model=list[JobOut])
def list_jobs(
    db: DbDep,
    _: CurrentUserDep,
    q: str | None = None,
    sort_by: Literal["created_at", "title", "company"] = "created_at",
    order: Literal["asc", "desc"] = "desc",
    limit: int = 30,
    offset: int = 0,
) -> list[JobOut]:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    stmt = select(Job)
    cutoff = datetime.utcnow() - timedelta(days=max(1, settings.jobs_stale_after_days))
    stmt = stmt.where(func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Job.title).like(like),
                func.lower(Job.company).like(like),
                func.lower(func.coalesce(Job.location, "")).like(like),
            )
        )

    sort_col = Job.created_at
    if sort_by == "title":
        sort_col = Job.title
    elif sort_by == "company":
        sort_col = Job.company

    stmt = stmt.order_by(desc(sort_col) if order == "desc" else asc(sort_col))

    jobs = db.scalars(stmt.limit(limit).offset(offset)).all()
    return [_job_out(j) for j in jobs]


class ScrapeQueueOut(BaseModel):
    task_id: str
    status: str = "queued"


class ScrapeUrlIn(BaseModel):
    url: HttpUrl | str
    kind: Literal["url", "rss"] = "url"

    def normalized_url(self) -> str:
        return str(self.url).strip()


@router.post("/ingest/remoteok", response_model=ScrapeQueueOut)
def queue_remoteok_ingest(_: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue Remote OK JSON ingest (``listing_source=remoteok``)."""
    res = ingest_remoteok_jobs_task.delay()
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/ingest/adzuna", response_model=ScrapeQueueOut)
def queue_adzuna_ingest(_: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue Adzuna API search ingest (``listing_source=adzuna``). Requires API keys in env."""
    res = ingest_adzuna_jobs_task.delay()
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/scrape", response_model=ScrapeQueueOut)
def queue_scrape(payload: ScrapeUrlIn, _: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue single-URL HTML scrape, or RSS/Atom fan-out (each link queued as ``scrape_job``)."""
    nu = payload.normalized_url()
    if payload.kind == "rss":
        res = scrape_rss_feed_task.delay(nu)
    else:
        res = scrape_job_task.delay(nu)
    return ScrapeQueueOut(task_id=str(res.id))


class FeedOut(BaseModel):
    job: JobOut
    score: float
    similarity: float | None = None


def _score_job_heuristic(*, job: Job, persona: str | None, focus: list[str]) -> float:
    tags = {t.lower() for t in (job.tags or [])}
    title_l = (job.title or "").lower()
    seniority = (job.seniority or "").lower()

    score = 0.0

    if persona == "student":
        if "intern" in tags or "intern" in title_l:
            score += 3.0
        if "graduate" in tags or "graduate" in title_l or "new grad" in title_l:
            score += 2.0
        if "junior" in seniority or "junior" in title_l:
            score += 1.0
    elif persona == "career_switcher":
        if "entry" in seniority or "junior" in seniority:
            score += 1.0
    elif persona == "employed_exploring":
        score += 0.25
    elif persona == "active_search":
        score += 0.5

    if "find_jobs" in focus:
        score += 0.5

    return score


def _resume_embedding_vector(db: Session, user_id: UUID) -> list[float] | None:
    doc = db.scalar(
        select(ResumeDocument)
        .where(
            ResumeDocument.user_id == user_id,
            ResumeDocument.status == ResumeStatus.EMBEDDED,
        )
        .order_by(desc(ResumeDocument.created_at))
        .limit(1)
    )
    if doc is None:
        return None
    if doc.embedding_vector is not None:
        return list(doc.embedding_vector)
    if isinstance(doc.embedding, list):
        return [float(x) for x in doc.embedding]
    return None


@router.get("/feed", response_model=list[FeedOut])
def feed(
    db: DbDep,
    current_user: CurrentUserDep,
    limit: int = 30,
    offset: int = 0,
) -> list[FeedOut]:
    """
    Personalized ordering: cosine similarity vs latest embedded résumé when available;
    otherwise persona/heuristic ranking (Phase 2 fallback).
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    profile = current_user.profile
    persona = profile.persona if profile else None
    focus: list[str] = []
    if profile and isinstance(profile.goals, dict):
        maybe = profile.goals.get("focus")
        if isinstance(maybe, list) and all(isinstance(x, str) for x in maybe):
            focus = maybe

    vec = _resume_embedding_vector(db, current_user.id)
    cutoff = datetime.utcnow() - timedelta(days=max(1, settings.jobs_stale_after_days))

    if vec and settings.openai_api_key:
        dist_expr = Job.embedding_vector.cosine_distance(vec)
        stmt = (
            select(Job, dist_expr.label("dist"))
            .where(Job.embedding_vector.is_not(None))
            .where(func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff)
            .order_by(dist_expr.asc())
            .limit(500)
        )
        rows = db.execute(stmt).all()
        if rows:
            out: list[FeedOut] = []
            for row in rows:
                job = row[0]
                dist = float(row[1])
                sim = max(0.0, min(100.0, 100.0 * (1.0 - dist / 2.0)))
                out.append(FeedOut(job=_job_out(job), score=sim, similarity=sim))
            return out[offset : offset + limit]

    jobs = db.scalars(
        select(Job)
        .where(func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff)
        .order_by(desc(Job.created_at))
        .limit(500)
    ).all()
    scored = [
        FeedOut(
            job=_job_out(j),
            score=_score_job_heuristic(job=j, persona=persona, focus=focus),
            similarity=None,
        )
        for j in jobs
    ]
    scored.sort(key=lambda x: (x.score, x.job.company, x.job.title), reverse=True)

    return scored[offset : offset + limit]


@router.post("/{job_id}/fit", response_model=FitScoreOut)
def score_job_fit(
    job_id: UUID,
    db: DbDep,
    current_user: CurrentUserDep,
) -> FitScoreOut:
    """Structured fit score via LLM; invalid JSON fails validation before response."""
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

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
        return compute_fit_score(job=job, resume_text=text)
    except FitScoreError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
