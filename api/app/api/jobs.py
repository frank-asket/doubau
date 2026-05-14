from __future__ import annotations

import hmac
from datetime import datetime, timedelta
from ipaddress import ip_address
from typing import Literal
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Body, HTTPException, Query, Request
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import and_, asc, delete, desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agents.fit_score import FitScoreError, FitScoreOut, compute_fit_score
from app.api.deps import CurrentUserDep, DbDep
from app.core.settings import settings
from app.jobs.catalog_query_from_resume import catalog_query_for_user
from app.jobs.matching import (
    feed_blend_weights,
    location_match_score,
    recency_score,
    seniority_match_score,
    weighted_match_score,
)
from app.jobs.url_hash import hash_source_url
from app.models.job import Job
from app.models.job_feedback import JobFeedback
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user import User
from app.tasks import embed_job as embed_job_task
from app.tasks import ingest_adzuna_jobs as ingest_adzuna_jobs_task
from app.tasks import ingest_jsearch_jobs as ingest_jsearch_jobs_task
from app.tasks import ingest_job_board_rss_batch as ingest_job_board_rss_batch_task
from app.tasks import ingest_remoteok_jobs as ingest_remoteok_jobs_task
from app.tasks import ingest_scrapling_jobs as ingest_scrapling_jobs_task
from app.tasks import ingest_serpapi_google_jobs as ingest_serpapi_google_jobs_task
from app.tasks import scrape_job as scrape_job_task
from app.tasks import scrape_rss_feed as scrape_rss_feed_task

router = APIRouter(prefix="/jobs", tags=["jobs"])

# Rows removed by ``POST /jobs/cron/clear-catalog`` when ``mode=providers`` (keeps ``manual``).
_CRON_CLEAR_PROVIDER_SOURCES: frozenset[str] = frozenset(
    {
        "remoteok",
        "adzuna",
        "scrapling",
        "scrapling_jsonld",
        "greenhouse",
        "lever",
        "ashby",
        "workday_cxs",
        "http_fetch",
        "jsearch",
        "serpapi_google_jobs",
    }
)


def _clear_redis_job_fingerprint_keys() -> int:
    """Best-effort delete of per-provider content fingerprints so re-ingest can insert again."""
    try:
        import redis

        r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        return 0
    n = 0
    try:
        for key in r.scan_iter(match="doubow:job_fp:*", count=500):
            n += int(r.delete(key))
    except Exception:
        return n
    return n


def _require_ingestion_admin(user: User) -> None:
    allowed = set(settings.admin_ingestion_user_ids_list)
    if not allowed or (str(user.id) not in allowed and user.email not in allowed):
        raise HTTPException(status_code=403, detail="Bulk job sync is restricted.")


def _validate_public_scrape_url(raw: str) -> str:
    value = raw.strip()
    parsed = urlparse(value if "://" in value else f"https://{value}")
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only http(s) job URLs can be imported.")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Import URL must include a host.")

    host = parsed.hostname.strip().lower()
    if host in {"localhost", "localhost.localdomain"} or host.endswith(".localhost"):
        raise HTTPException(status_code=400, detail="Localhost URLs cannot be imported.")

    try:
        addr = ip_address(host.strip("[]"))
    except ValueError:
        addr = None
    if addr is not None and (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    ):
        raise HTTPException(status_code=400, detail="Private network URLs cannot be imported.")

    return parsed.geturl()


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


class CatalogSummaryOut(BaseModel):
    active_total: int
    embedded_total: int
    missing_embedding_total: int
    with_source_url_total: int
    by_source: dict[str, int] = Field(default_factory=dict)
    by_location: dict[str, int] = Field(default_factory=dict)
    stale_after_days: int


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


class JobFeedbackIn(BaseModel):
    action: Literal["hide", "downvote", "upvote"] = "hide"
    reason: str | None = Field(default=None, max_length=240)


class JobFeedbackOut(BaseModel):
    job_id: UUID
    action: str
    reason: str | None = None
    created_at: datetime


@router.post("/{job_id}/feedback", response_model=JobFeedbackOut)
def leave_feedback(
    job_id: UUID,
    payload: JobFeedbackIn,
    db: DbDep,
    user: CurrentUserDep,
) -> JobFeedbackOut:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = db.scalar(
        select(JobFeedback).where(
            and_(
                JobFeedback.user_id == user.id,
                JobFeedback.job_id == job_id,
            )
        )
    )
    if existing is not None:
        existing.action = payload.action
        existing.reason = payload.reason
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return JobFeedbackOut(
            job_id=existing.job_id,
            action=existing.action,
            reason=existing.reason,
            created_at=existing.created_at,
        )

    fb = JobFeedback(
        user_id=user.id,
        job_id=job_id,
        action=payload.action,
        reason=payload.reason,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return JobFeedbackOut(
        job_id=fb.job_id,
        action=fb.action,
        reason=fb.reason,
        created_at=fb.created_at,
    )


@router.delete("/{job_id}/feedback", response_model=dict)
def clear_feedback(job_id: UUID, db: DbDep, user: CurrentUserDep) -> dict:
    fb = db.scalar(
        select(JobFeedback).where(
            and_(
                JobFeedback.user_id == user.id,
                JobFeedback.job_id == job_id,
            )
        )
    )
    if fb is not None:
        db.delete(fb)
        db.commit()
    return {"status": "ok"}


class JobMatchEventIn(BaseModel):
    event_type: Literal[
        "impression",
        "click_out",
        "apply_click",
        "dismiss",
        "save",
    ]
    reason: str | None = Field(default=None, max_length=240)
    meta: dict | None = None


@router.post("/{job_id}/events", response_model=dict)
def track_job_event(
    job_id: UUID,
    payload: JobMatchEventIn,
    db: DbDep,
    user: CurrentUserDep,
) -> dict:
    from app.models.job_match_event import JobMatchEvent

    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    ev = JobMatchEvent(
        user_id=user.id,
        job_id=job_id,
        event_type=payload.event_type,
        reason=payload.reason,
        meta=payload.meta,
    )
    db.add(ev)
    db.commit()
    return {"status": "ok"}


@router.post("", response_model=JobOut)
def create_job(payload: JobCreate, db: DbDep, user: CurrentUserDep) -> JobOut:
    _require_ingestion_admin(user)
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
    user: CurrentUserDep,
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
    stmt = stmt.where(Job.is_stale.is_(False))
    stmt = stmt.where(
        ~select(JobFeedback.id)
        .where(
            and_(
                JobFeedback.user_id == user.id,
                JobFeedback.job_id == Job.id,
                JobFeedback.action == "hide",
            )
        )
        .exists()
    )
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


@router.get("/hidden", response_model=list[JobOut])
def list_hidden_jobs(
    db: DbDep,
    user: CurrentUserDep,
    limit: int = 50,
    offset: int = 0,
) -> list[JobOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    cutoff = datetime.utcnow() - timedelta(days=max(1, settings.jobs_stale_after_days))
    stmt = (
        select(Job)
        .join(
            JobFeedback,
            and_(
                JobFeedback.job_id == Job.id,
                JobFeedback.user_id == user.id,
                JobFeedback.action == "hide",
            ),
        )
        .where(func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff)
        .where(Job.is_stale.is_(False))
        .order_by(desc(JobFeedback.created_at))
    )
    jobs = db.scalars(stmt.limit(limit).offset(offset)).all()
    return [_job_out(j) for j in jobs]


@router.get("/catalog/summary", response_model=CatalogSummaryOut)
def catalog_summary(db: DbDep, _: CurrentUserDep) -> CatalogSummaryOut:
    cutoff = datetime.utcnow() - timedelta(days=max(1, settings.jobs_stale_after_days))
    active_filters = (
        func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff,
        Job.is_stale.is_(False),
    )

    active_total = int(
        db.scalar(select(func.count()).select_from(Job).where(*active_filters)) or 0
    )
    embedded_total = int(
        db.scalar(
            select(func.count())
            .select_from(Job)
            .where(*active_filters)
            .where(Job.embedding_vector.is_not(None))
        )
        or 0
    )
    with_source_url_total = int(
        db.scalar(
            select(func.count())
            .select_from(Job)
            .where(*active_filters)
            .where(Job.source_url.is_not(None))
        )
        or 0
    )

    # Same SQL expression in SELECT and GROUP BY so partitions match labels (PG + counts).
    source_key = func.coalesce(Job.listing_source, "unknown")
    location_key = func.coalesce(Job.location, "Unspecified")
    source_rows = db.execute(
        select(source_key, func.count())
        .where(*active_filters)
        .group_by(source_key)
        .order_by(desc(func.count()))
    ).all()
    location_rows = db.execute(
        select(location_key, func.count())
        .where(*active_filters)
        .group_by(location_key)
        .order_by(desc(func.count()))
        .limit(12)
    ).all()

    return CatalogSummaryOut(
        active_total=active_total,
        embedded_total=embedded_total,
        missing_embedding_total=max(0, active_total - embedded_total),
        with_source_url_total=with_source_url_total,
        by_source={str(k): int(v) for k, v in source_rows},
        by_location={str(k): int(v) for k, v in location_rows},
        stale_after_days=max(1, settings.jobs_stale_after_days),
    )


class ScrapeQueueOut(BaseModel):
    task_id: str
    status: str = "queued"


class ProviderIngestQueryIn(BaseModel):
    """Optional JSON for JSearch / SerpAPI ingest: fixed query and/or derive from a user's profile + résumé."""

    query: str | None = Field(default=None, max_length=400)
    resume_user_id: UUID | None = Field(
        default=None,
        description="If set (and ``query`` is empty), build the API search string from this user's goals + résumé.",
    )


class ScrapeUrlIn(BaseModel):
    url: HttpUrl | str
    kind: Literal["url", "rss"] = "url"

    def normalized_url(self) -> str:
        return str(self.url).strip()


@router.post("/ingest/remoteok", response_model=ScrapeQueueOut)
def queue_remoteok_ingest(user: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue Remote OK JSON ingest (``listing_source=remoteok``)."""
    _require_ingestion_admin(user)
    res = ingest_remoteok_jobs_task.delay()
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/ingest/adzuna", response_model=ScrapeQueueOut)
def queue_adzuna_ingest(user: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue Adzuna API search ingest (``listing_source=adzuna``). Requires API keys in env."""
    _require_ingestion_admin(user)
    res = ingest_adzuna_jobs_task.delay()
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/ingest/scrapling", response_model=ScrapeQueueOut)
def queue_scrapling_ingest(user: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue Scrapling/Greenhouse/JSON-LD ingest when ``SCRAPLING_ENABLED=true``."""
    _require_ingestion_admin(user)
    res = ingest_scrapling_jobs_task.delay()
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/ingest/jsearch", response_model=ScrapeQueueOut)
def queue_jsearch_ingest(
    user: CurrentUserDep,
    db: DbDep,
    payload: ProviderIngestQueryIn = Body(default_factory=ProviderIngestQueryIn),
) -> ScrapeQueueOut:
    """Enqueue JSearch (RapidAPI) ingest — multi-board jobs (``listing_source=jsearch``). Requires API key.

    Body (optional): ``query`` overrides everything. Else ``resume_user_id`` builds a string from that user's
    profile + résumé. Else ``DOUBOW_JSEARCH_QUERY`` (or a neutral default when unset).
    """
    _require_ingestion_admin(user)
    q_override: str | None = None
    if payload.query is not None and payload.query.strip():
        q_override = payload.query.strip()[:400]
    elif payload.resume_user_id is not None:
        u = db.get(User, payload.resume_user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="User not found.")
        derived = catalog_query_for_user(db, payload.resume_user_id).strip()
        q_override = derived[:400] if derived else None
    res = ingest_jsearch_jobs_task.delay(query_override=q_override)
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/ingest/serpapi-google-jobs", response_model=ScrapeQueueOut)
def queue_serpapi_google_jobs_ingest(
    user: CurrentUserDep,
    db: DbDep,
    payload: ProviderIngestQueryIn = Body(default_factory=ProviderIngestQueryIn),
) -> ScrapeQueueOut:
    """Enqueue SerpAPI Google Jobs ingest (``listing_source=serpapi_google_jobs``). Requires API key.

    Same optional body semantics as ``POST /jobs/ingest/jsearch`` (``query`` / ``resume_user_id`` / env).
    """
    _require_ingestion_admin(user)
    q_override: str | None = None
    if payload.query is not None and payload.query.strip():
        q_override = payload.query.strip()[:400]
    elif payload.resume_user_id is not None:
        u = db.get(User, payload.resume_user_id)
        if u is None:
            raise HTTPException(status_code=404, detail="User not found.")
        derived = catalog_query_for_user(db, payload.resume_user_id).strip()
        q_override = derived[:400] if derived else None
    res = ingest_serpapi_google_jobs_task.delay(query_override=q_override)
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/ingest/rss-feeds", response_model=ScrapeQueueOut)
def queue_job_board_rss_batch(user: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue ``scrape_rss_feed`` for each URL in ``DOUBOW_JOB_BOARD_RSS_URLS``."""
    _require_ingestion_admin(user)
    res = ingest_job_board_rss_batch_task.delay()
    return ScrapeQueueOut(task_id=str(res.id))


@router.post("/scrape", response_model=ScrapeQueueOut)
def queue_scrape(payload: ScrapeUrlIn, user: CurrentUserDep) -> ScrapeQueueOut:
    """Enqueue single-URL HTML scrape, or RSS/Atom fan-out (each link queued as ``scrape_job``)."""
    _require_ingestion_admin(user)
    nu = _validate_public_scrape_url(payload.normalized_url())
    if payload.kind == "rss":
        res = scrape_rss_feed_task.delay(nu)
    else:
        res = scrape_job_task.delay(nu)
    return ScrapeQueueOut(task_id=str(res.id))


class CronQueueIngestOut(BaseModel):
    """Celery task IDs queued by ``POST /jobs/cron/queue-ingest``."""

    queued: dict[str, str]


def _cron_ingest_secret_ok(request: Request) -> None:
    secret = (settings.cron_ingest_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=404, detail="Not found")
    sent = (request.headers.get("X-Doubow-Cron-Secret") or "").strip()
    if len(sent) != len(secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not hmac.compare_digest(sent, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/cron/queue-ingest", response_model=CronQueueIngestOut)
def cron_queue_provider_ingest(request: Request) -> CronQueueIngestOut:
    """Queue catalog ingest tasks without Clerk (automation).

    Set ``DOUBOW_CRON_INGEST_SECRET`` on the API, then call with header
    ``X-Doubow-Cron-Secret: <same value>`` from GitHub Actions, Railway Cron, or a manual ``curl``.

    Requires a running **Celery worker** with the ``scrape`` queue and **Redis**; otherwise tasks
    sit in the broker until a worker is available.

    If the secret is unset, returns **404** so the endpoint is not discoverable.
    """
    _cron_ingest_secret_ok(request)
    queued: dict[str, str] = {}
    r_ro = ingest_remoteok_jobs_task.delay()
    queued["remoteok"] = str(r_ro.id)
    r_ad = ingest_adzuna_jobs_task.delay()
    queued["adzuna"] = str(r_ad.id)
    r_js = ingest_jsearch_jobs_task.delay()
    queued["jsearch"] = str(r_js.id)
    r_sp = ingest_serpapi_google_jobs_task.delay()
    queued["serpapi_google_jobs"] = str(r_sp.id)
    r_rss = ingest_job_board_rss_batch_task.delay()
    queued["job_board_rss_batch"] = str(r_rss.id)
    if settings.scrapling_enabled:
        r_sc = ingest_scrapling_jobs_task.delay()
        queued["scrapling"] = str(r_sc.id)
    return CronQueueIngestOut(queued=queued)


class CronClearCatalogOut(BaseModel):
    """Result of ``POST /jobs/cron/clear-catalog``."""

    mode: Literal["providers", "all"]
    jobs_deleted: int
    fingerprint_keys_deleted: int


@router.post("/cron/clear-catalog", response_model=CronClearCatalogOut)
def cron_clear_job_catalog(
    request: Request,
    db: DbDep,
    mode: Literal["providers", "all"] = "providers",
) -> CronClearCatalogOut:
    """Delete catalog job rows so a fresh ingest run is visible (automation).

    Uses the same ``X-Doubow-Cron-Secret`` as ``POST /jobs/cron/queue-ingest``.

    - ``mode=providers`` (default): deletes rows whose ``listing_source`` is one of the ingest
      pipelines (Remote OK, Adzuna, Scrapling/Greenhouse, single-URL import). Rows with
      ``listing_source=manual`` are kept.
    - ``mode=all``: deletes **every** job row (including manual). Use with care.

    Also clears Redis keys ``doubow:job_fp:*`` so fingerprint dedup does not block re-inserts.
    Dependent rows (e.g. job feedback) cascade on delete.

    Returns **404** when ``DOUBOW_CRON_INGEST_SECRET`` is unset.
    """
    _cron_ingest_secret_ok(request)
    if mode == "all":
        stmt = delete(Job)
    else:
        stmt = delete(Job).where(Job.listing_source.in_(_CRON_CLEAR_PROVIDER_SOURCES))
    result = db.execute(stmt)
    db.commit()
    jobs_deleted = int(result.rowcount or 0)
    fp_deleted = _clear_redis_job_fingerprint_keys()
    return CronClearCatalogOut(
        mode=mode,
        jobs_deleted=jobs_deleted,
        fingerprint_keys_deleted=fp_deleted,
    )


class FeedOut(BaseModel):
    job: JobOut
    score: float
    similarity: float | None = None
    score_reason: str
    score_components: dict[str, float] = Field(default_factory=dict)


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
    if doc.embedding_model != settings.openai_embedding_model:
        return None
    if doc.embedding_vector is not None:
        return list(doc.embedding_vector)
    if isinstance(doc.embedding, list):
        return [float(x) for x in doc.embedding]
    return None


def _feedback_adjustments(db: Session, *, user_id: UUID, job_ids: list[UUID]) -> dict[UUID, float]:
    """
    Convert explicit user feedback into a small adjustment to blended score.

    - hide: excluded upstream
    - upvote: slight boost
    - downvote: noticeable penalty
    """
    if not job_ids:
        return {}

    rows = db.execute(
        select(JobFeedback.job_id, JobFeedback.action).where(
            and_(
                JobFeedback.user_id == user_id,
                JobFeedback.job_id.in_(job_ids),
                JobFeedback.action.in_(("upvote", "downvote")),
            )
        )
    ).all()

    out: dict[UUID, float] = {}
    for job_id, action in rows:
        if action == "upvote":
            out[job_id] = 0.08
        elif action == "downvote":
            out[job_id] = -0.18
    return out


def _score_reason(
    *,
    similarity: float | None,
    location_score_: float,
    seniority_score_: float,
    recency_score__: float,
    feedback_adjustment: float,
) -> str:
    parts: list[str] = []
    if similarity is not None and similarity >= 0.65:
        parts.append("strong résumé overlap")
    elif similarity is not None and similarity >= 0.35:
        parts.append("some résumé overlap")
    if location_score_ >= 0.9:
        parts.append("location fit")
    elif location_score_ >= 0.7:
        parts.append("remote/regional fit")
    if seniority_score_ >= 0.8:
        parts.append("seniority fit")
    if recency_score__ >= 0.8:
        parts.append("fresh listing")
    if feedback_adjustment > 0:
        parts.append("boosted by your feedback")
    if feedback_adjustment < 0:
        parts.append("reduced by your feedback")
    return ", ".join(parts[:3]) or "ranked from your profile and listing freshness"


def _job_location_remote_filter():
    """Loose SQL filter for remote-first / distributed roles (listing text varies by provider)."""
    loc = func.lower(func.coalesce(Job.location, ""))
    return or_(
        loc.like("%remote%"),
        loc.like("%anywhere%"),
        loc.like("%distributed%"),
        loc.like("%worldwide%"),
        loc.like("%fully remote%"),
    )


@router.get("/feed", response_model=list[FeedOut])
def feed(
    db: DbDep,
    current_user: CurrentUserDep,
    limit: int = 30,
    offset: int = 0,
    match_scope: Literal["default", "worldwide"] = Query(
        "default",
        description="default: regional location weighting; worldwide: favor résumé similarity over geography",
    ),
    remote_only: bool = Query(
        False,
        description="Restrict to listings whose location text suggests remote / anywhere / distributed",
    ),
) -> list[FeedOut]:
    """
    Personalized ordering: cosine similarity vs latest embedded résumé when available;
    otherwise persona/heuristic ranking (Phase 2 fallback).

    Query ``match_scope=worldwide`` lowers the weight of geography vs semantic fit for
    cross-border / remote-first job seekers. ``remote_only=true`` restricts candidates to
    listings whose location text suggests remote or distributed work.
    """
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    w_vec, w_loc, w_sen, w_rec = feed_blend_weights(match_scope=match_scope)
    remote_filter = _job_location_remote_filter() if remote_only else None

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
            .where(Job.embedding_model == settings.openai_embedding_model)
            .where(func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff)
            .where(Job.is_stale.is_(False))
            .where(
                ~select(JobFeedback.id)
                .where(
                    and_(
                        JobFeedback.user_id == current_user.id,
                        JobFeedback.job_id == Job.id,
                        JobFeedback.action == "hide",
                    )
                )
                .exists()
            )
        )
        if remote_filter is not None:
            stmt = stmt.where(remote_filter)
        stmt = stmt.order_by(dist_expr.asc()).limit(500)
        rows = db.execute(stmt).all()
        if rows:
            user_loc = profile.location if profile else None
            user_yrs = profile.years_experience if profile else None
            window = max(1, settings.jobs_stale_after_days)
            fb_adj = _feedback_adjustments(
                db,
                user_id=current_user.id,
                job_ids=[r[0].id for r in rows],
            )

            scored_rows: list[tuple[float, float, Job, float, float, float, float]] = []
            for row in rows:
                job = row[0]
                dist = float(row[1])
                vec_sim = max(0.0, min(1.0, 1.0 - dist / 2.0))
                loc_s = location_match_score(
                    user_location=user_loc,
                    job_location=job.location,
                    match_scope=match_scope,
                )
                sen_s = seniority_match_score(
                    years_experience=user_yrs,
                    job_seniority=job.seniority,
                    job_title=job.title,
                )
                rec_s = recency_score(
                    posted_at=job.source_posted_at,
                    created_at=job.created_at,
                    window_days=window,
                )
                blended = weighted_match_score(
                    vector_sim=vec_sim,
                    location_score=loc_s,
                    seniority_score=sen_s,
                    recency_score_=rec_s,
                    w_vec=w_vec,
                    w_loc=w_loc,
                    w_sen=w_sen,
                    w_rec=w_rec,
                )
                adj = fb_adj.get(job.id, 0.0)
                blended = max(0.0, min(1.0, blended + adj))
                scored_rows.append((blended, vec_sim, job, loc_s, sen_s, rec_s, adj))

            scored_rows.sort(key=lambda t: (t[0], t[1]), reverse=True)

            out: list[FeedOut] = []
            for blended, vec_sim, job, loc_s, sen_s, rec_s, adj in scored_rows:
                pct = max(0.0, min(100.0, 100.0 * blended))
                sim_pct = max(0.0, min(100.0, 100.0 * vec_sim))
                out.append(
                    FeedOut(
                        job=_job_out(job),
                        score=pct,
                        similarity=sim_pct,
                        score_reason=_score_reason(
                            similarity=vec_sim,
                            location_score_=loc_s,
                            seniority_score_=sen_s,
                            recency_score__=rec_s,
                            feedback_adjustment=adj,
                        ),
                        score_components={
                            "resume": round(vec_sim * 100, 1),
                            "location": round(loc_s * 100, 1),
                            "seniority": round(sen_s * 100, 1),
                            "freshness": round(rec_s * 100, 1),
                        },
                    )
                )

            return out[offset : offset + limit]

    jobs_stmt = (
        select(Job)
        .where(func.coalesce(Job.source_posted_at, Job.created_at) >= cutoff)
        .where(Job.is_stale.is_(False))
        .where(
            ~select(JobFeedback.id)
            .where(
                and_(
                    JobFeedback.user_id == current_user.id,
                    JobFeedback.job_id == Job.id,
                    JobFeedback.action == "hide",
                )
            )
            .exists()
        )
    )
    if remote_filter is not None:
        jobs_stmt = jobs_stmt.where(remote_filter)
    jobs_stmt = jobs_stmt.order_by(desc(Job.created_at)).limit(500)
    jobs = db.scalars(jobs_stmt).all()
    user_loc = profile.location if profile else None
    user_yrs = profile.years_experience if profile else None
    window = max(1, settings.jobs_stale_after_days)
    fb_adj2 = _feedback_adjustments(db, user_id=current_user.id, job_ids=[j.id for j in jobs])

    # Heuristic max (student persona): intern(3)+graduate(2)+junior(1)+find_jobs(0.5)
    heur_max = 6.5

    reranked: list[FeedOut] = []
    scored_rows2: list[tuple[float, float, Job, float, float, float, float]] = []
    for j in jobs:
        heur = _score_job_heuristic(job=j, persona=persona, focus=focus)
        base_sim = max(0.0, min(1.0, heur / heur_max))
        loc_s = location_match_score(
            user_location=user_loc,
            job_location=j.location,
            match_scope=match_scope,
        )
        sen_s = seniority_match_score(
            years_experience=user_yrs,
            job_seniority=j.seniority,
            job_title=j.title,
        )
        rec_s = recency_score(
            posted_at=j.source_posted_at,
            created_at=j.created_at,
            window_days=window,
        )
        blended = weighted_match_score(
            vector_sim=base_sim,
            location_score=loc_s,
            seniority_score=sen_s,
            recency_score_=rec_s,
            w_vec=w_vec,
            w_loc=w_loc,
            w_sen=w_sen,
            w_rec=w_rec,
        )
        adj = fb_adj2.get(j.id, 0.0)
        blended = max(0.0, min(1.0, blended + adj))
        scored_rows2.append((blended, base_sim, j, loc_s, sen_s, rec_s, adj))

    scored_rows2.sort(
        key=lambda t: (t[0], t[1], (t[2].company or ""), (t[2].title or "")),
        reverse=True,
    )

    for blended, base_sim, j, loc_s, sen_s, rec_s, adj in scored_rows2:
        pct = max(0.0, min(100.0, 100.0 * blended))
        sim_pct = max(0.0, min(100.0, 100.0 * base_sim))
        reranked.append(
            FeedOut(
                job=_job_out(j),
                score=pct,
                similarity=sim_pct,
                score_reason=_score_reason(
                    similarity=base_sim,
                    location_score_=loc_s,
                    seniority_score_=sen_s,
                    recency_score__=rec_s,
                    feedback_adjustment=adj,
                ),
                score_components={
                    "profile": round(base_sim * 100, 1),
                    "location": round(loc_s * 100, 1),
                    "seniority": round(sen_s * 100, 1),
                    "freshness": round(rec_s * 100, 1),
                },
            )
        )

    return reranked[offset : offset + limit]


@router.get("/{job_id}", response_model=JobOut)
def get_job(job_id: UUID, db: DbDep, current_user: CurrentUserDep) -> JobOut:
    """Single job for detail view.

    Registered after /feed and /hidden so those paths are not captured.
    """
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_out(job)


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
