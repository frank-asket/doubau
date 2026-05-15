"""Authenticated proxies to third-party APIs (RapidAPI, etc.)."""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, or_, select

from app.api.deps import CurrentUserDep, DbDep
from app.core.settings import settings
from app.integrations.glassdoor_realtime import (
    fetch_company_interview_details,
    fetch_glassdoor_realtime_resource,
)
from app.integrations.job_opening_analyzer import post_compute_similarity
from app.integrations.rapidapi_status import rapidapi_integration_status
from app.models.company_enrichment import CompanyEnrichment
from app.tasks import ingest_glassdoor_company_context as ingest_glassdoor_company_context_task
from app.tasks import ingest_glassdoor_interview_details as ingest_glassdoor_interview_details_task

router = APIRouter(prefix="/integrations", tags=["integrations"])
log = logging.getLogger(__name__)

_GLASSDOOR_SALARY_CACHE_TTL_SECONDS = 86_400


def _salary_cache_key(title: str, location: str | None) -> str:
    raw = json.dumps(
        {
            "title": " ".join(title.lower().split()),
            "location": " ".join((location or "").lower().split()),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"doubow:glassdoor_salary:{digest}"


def _salary_cache_get(key: str) -> Any | None:
    try:
        import redis

        client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        raw = client.get(key)
    except Exception as exc:
        log.info("glassdoor salary cache read skipped: %s", exc)
        return None
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def _salary_cache_set(key: str, data: Any) -> None:
    try:
        import redis

        client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        client.setex(key, _GLASSDOOR_SALARY_CACHE_TTL_SECONDS, json.dumps(data))
    except Exception as exc:
        log.info("glassdoor salary cache write skipped: %s", exc)


class RapidApiIntegrationStatusOut(BaseModel):
    """Which RapidAPI products have usable keys (shared or product-specific)."""

    shared_rapidapi_key_configured: bool
    jsearch_configured: bool
    active_jobs_db_configured: bool
    glassdoor_realtime_configured: bool
    job_opening_analyzer_configured: bool


class JobOpeningAnalyzerSimilarityIn(BaseModel):
    """Body for RapidAPI Job Opening Analyzer ``compute_similarity``."""

    pivot: str = Field(
        ...,
        min_length=1,
        max_length=100_000,
        description="Reference text (e.g. résumé or candidate profile).",
    )
    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Job opening texts to score against the pivot (upstream ``texts`` array).",
    )


class GlassdoorCompanyIngestIn(BaseModel):
    companies: list[str] = Field(default_factory=list, max_length=100)
    include_catalog: bool = True
    limit: int = Field(default=50, ge=1, le=500)


class GlassdoorCompanyIngestOut(BaseModel):
    task_id: str
    status: str = "queued"


class GlassdoorInterviewDetailsIngestIn(BaseModel):
    interview_ids: list[str] = Field(default_factory=list, min_length=1, max_length=200)


class CompanyEnrichmentOut(BaseModel):
    id: str
    provider: str
    normalized_company: str
    company_name: str
    provider_ref: str | None = None
    website_url: str | None = None
    logo_url: str | None = None
    rating: float | None = None
    review_count: int | None = None
    interview_count: int | None = None
    source: str
    fetched_at: str


def _require_integration_admin(current_user: CurrentUserDep) -> None:
    allowed = set(settings.admin_ingestion_user_ids_list)
    if not allowed or (str(current_user.id) not in allowed and current_user.email not in allowed):
        raise HTTPException(status_code=403, detail="Integration ingest is restricted.")


def _company_enrichment_out(row: CompanyEnrichment) -> CompanyEnrichmentOut:
    return CompanyEnrichmentOut(
        id=str(row.id),
        provider=row.provider,
        normalized_company=row.normalized_company,
        company_name=row.company_name,
        provider_ref=row.provider_ref,
        website_url=row.website_url,
        logo_url=row.logo_url,
        rating=row.rating,
        review_count=row.review_count,
        interview_count=row.interview_count,
        source=row.source,
        fetched_at=row.fetched_at.isoformat(),
    )


@router.get("/rapidapi/status", response_model=RapidApiIntegrationStatusOut)
def rapidapi_status(current_user: CurrentUserDep) -> RapidApiIntegrationStatusOut:
    """Report RapidAPI credential coverage for debugging and admin UIs (no secrets)."""
    _ = current_user
    return RapidApiIntegrationStatusOut(**rapidapi_integration_status())


@router.post("/glassdoor/ingest/company-context", response_model=GlassdoorCompanyIngestOut)
def queue_glassdoor_company_context_ingest(
    current_user: CurrentUserDep,
    payload: Annotated[GlassdoorCompanyIngestIn | None, Body()] = None,
) -> GlassdoorCompanyIngestOut:
    """Queue Glassdoor Real-time employer enrichment for catalog or explicit companies."""
    _require_integration_admin(current_user)
    payload = payload or GlassdoorCompanyIngestIn()
    companies = [c.strip() for c in payload.companies if c.strip()]
    if not payload.include_catalog and not companies:
        raise HTTPException(
            status_code=400,
            detail="Provide companies or set include_catalog=true.",
        )
    res = ingest_glassdoor_company_context_task.delay(companies or None, payload.limit)
    return GlassdoorCompanyIngestOut(task_id=str(res.id))


@router.post("/glassdoor/ingest/interview-details", response_model=GlassdoorCompanyIngestOut)
def queue_glassdoor_interview_details_ingest(
    current_user: CurrentUserDep,
    payload: Annotated[GlassdoorInterviewDetailsIngestIn, Body()],
) -> GlassdoorCompanyIngestOut:
    """Queue Glassdoor Real-time interview-detail ingestion by interview id."""
    _require_integration_admin(current_user)
    interview_ids = [i.strip() for i in payload.interview_ids if i.strip()]
    if not interview_ids:
        raise HTTPException(status_code=400, detail="Provide at least one interview id.")
    res = ingest_glassdoor_interview_details_task.delay(interview_ids)
    return GlassdoorCompanyIngestOut(task_id=str(res.id))


@router.get("/glassdoor/company-enrichments", response_model=list[CompanyEnrichmentOut])
def list_glassdoor_company_enrichments(
    current_user: CurrentUserDep,
    db: DbDep,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[CompanyEnrichmentOut]:
    """Persisted employer context from Glassdoor Real-time company ingestion."""
    _ = current_user
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    stmt = select(CompanyEnrichment).where(CompanyEnrichment.provider == "glassdoor_realtime")
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(CompanyEnrichment.company_name).like(like),
                func.lower(CompanyEnrichment.normalized_company).like(like),
            )
        )
    rows = db.scalars(
        stmt.order_by(desc(CompanyEnrichment.fetched_at)).limit(limit).offset(offset)
    ).all()
    return [_company_enrichment_out(row) for row in rows]


def _glassdoor_proxy(
    resource: str,
    current_user: CurrentUserDep,
    params: dict[str, str | None],
) -> Any:
    _ = current_user
    data, err = fetch_glassdoor_realtime_resource(resource, params)
    if err == "missing_glassdoor_realtime_credentials":
        raise HTTPException(
            status_code=503,
            detail=(
                "Glassdoor Real-time RapidAPI is not configured. Set "
                "DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY."
            ),
        )
    if err == "unsupported_glassdoor_realtime_resource":
        raise HTTPException(status_code=404, detail="Unsupported Glassdoor Real-time resource.")
    if err:
        raise HTTPException(status_code=502, detail=f"Upstream error: {err}")
    return data


@router.get("/glassdoor/conversations")
def glassdoor_conversations(
    current_user: CurrentUserDep,
    q: str | None = None,
    query: str | None = None,
    page: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time conversation/review search."""
    return _glassdoor_proxy("conversations", current_user, {"q": q, "query": query, "page": page})


@router.get("/glassdoor/jobs")
def glassdoor_jobs(
    current_user: CurrentUserDep,
    q: str | None = None,
    query: str | None = None,
    location: str | None = None,
    company_id: str | None = None,
    page: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time job listings."""
    return _glassdoor_proxy(
        "jobs",
        current_user,
        {"q": q, "query": query, "location": location, "company_id": company_id, "page": page},
    )


@router.get("/glassdoor/jobs/details")
def glassdoor_job_details(
    current_user: CurrentUserDep,
    job_id: str | None = None,
    jobId: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time job details."""
    jid = (job_id or jobId or "").strip()
    if not jid:
        raise HTTPException(status_code=400, detail="Missing job_id.")
    return _glassdoor_proxy("job_details", current_user, {"job_id": jid, "jobId": jid})


@router.get("/glassdoor/companies")
def glassdoor_companies(
    current_user: CurrentUserDep,
    q: str | None = None,
    query: str | None = None,
    company: str | None = None,
    page: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time company search."""
    return _glassdoor_proxy(
        "companies",
        current_user,
        {"q": q, "query": query, "company": company, "page": page},
    )


@router.get("/glassdoor/companies/details")
def glassdoor_company_details(
    current_user: CurrentUserDep,
    company_id: str | None = None,
    companyId: str | None = None,
    company: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time company details."""
    cid = (company_id or companyId or "").strip()
    return _glassdoor_proxy(
        "company_details",
        current_user,
        {"company_id": cid, "companyId": cid, "company": company},
    )


@router.get("/glassdoor/companies/reviews")
def glassdoor_company_reviews(
    current_user: CurrentUserDep,
    company_id: str | None = None,
    companyId: str | None = None,
    page: str | None = None,
    sort: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time company reviews/conversations."""
    cid = (company_id or companyId or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="Missing company_id.")
    return _glassdoor_proxy(
        "company_reviews",
        current_user,
        {"company_id": cid, "companyId": cid, "page": page, "sort": sort},
    )


@router.get("/glassdoor/companies/interviews")
def glassdoor_company_interviews(
    current_user: CurrentUserDep,
    company_id: str | None = None,
    companyId: str | None = None,
    page: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time company interviews."""
    cid = (company_id or companyId or "").strip()
    if not cid:
        raise HTTPException(status_code=400, detail="Missing company_id.")
    return _glassdoor_proxy(
        "company_interviews",
        current_user,
        {"company_id": cid, "companyId": cid, "page": page},
    )


@router.get("/glassdoor/companies/interview-details")
def glassdoor_company_interview_details(
    current_user: CurrentUserDep,
    interview_id: str | None = Query(
        None,
        min_length=1,
        max_length=24,
        description="Numeric Glassdoor interview id (maps to upstream ``interviewId``).",
    ),
    interviewId: str | None = Query(
        None,
        min_length=1,
        max_length=24,
        description="RapidAPI-compatible alias for ``interview_id``.",
    ),
) -> Any:
    """Proxy to RapidAPI Glassdoor Real-time ``GET /companies/interview-details``.

    Requires a logged-in user. Configure ``DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY``
    or a shared RapidAPI key.
    Response body is passed through from upstream (JSON object or array).
    """
    _ = current_user
    iid = (interview_id or interviewId or "").strip()
    if not iid:
        raise HTTPException(status_code=400, detail="Missing interview_id.")
    if not iid.isdigit():
        raise HTTPException(status_code=400, detail="interview_id must be numeric.")

    data, err = fetch_company_interview_details(iid)
    if err == "missing_glassdoor_realtime_credentials":
        raise HTTPException(
            status_code=503,
            detail=(
                "Glassdoor Real-time RapidAPI is not configured. Set "
                "DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY."
            ),
        )
    if err == "missing_interview_id" or err == "invalid_interview_id":
        raise HTTPException(status_code=400, detail="Invalid interview_id.")
    if err:
        raise HTTPException(status_code=502, detail=f"Upstream error: {err}")
    return data


@router.get("/glassdoor/salaries")
def glassdoor_salaries(
    current_user: CurrentUserDep,
    job_title: str | None = None,
    jobTitle: str | None = None,
    location: str | None = None,
    company_id: str | None = None,
    companyId: str | None = None,
    years_of_experience: str | None = None,
    page: str | None = None,
) -> Any:
    """Proxy Glassdoor Real-time salary estimates, cached per title/location for 24h."""
    title = (job_title or jobTitle or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Missing job_title.")
    cid = (company_id or companyId or "").strip()
    cacheable = not cid and not page
    cache_key = _salary_cache_key(title, location) if cacheable else ""
    if cache_key:
        cached = _salary_cache_get(cache_key)
        if cached is not None:
            return cached

    data = _glassdoor_proxy(
        "salaries",
        current_user,
        {
            "job_title": title,
            "jobTitle": title,
            "location": location,
            "company_id": cid,
            "companyId": cid,
            "years_of_experience": years_of_experience,
            "page": page,
        },
    )
    if cache_key:
        _salary_cache_set(cache_key, data)
    return data


@router.post("/job-opening-analyzer/compute-similarity")
def job_opening_analyzer_compute_similarity(
    current_user: CurrentUserDep,
    payload: JobOpeningAnalyzerSimilarityIn = Body(...),  # noqa: B008
) -> Any:
    """Proxy to RapidAPI Job Opening Analyzer ``POST /compute_similarity``.

    Compare one ``pivot`` string (typically a résumé) against multiple job-description strings.
    Configure ``DOUBOW_JOB_OPENING_ANALYZER_RAPIDAPI_KEY`` or a shared RapidAPI key. Request sizes
    are capped per ``DOUBOW_JOB_OPENING_ANALYZER_*`` settings.
    """
    _ = current_user
    data, err = post_compute_similarity(pivot=payload.pivot, texts=payload.texts)
    if err == "missing_job_opening_analyzer_credentials":
        raise HTTPException(
            status_code=503,
            detail=(
                "Job Opening Analyzer RapidAPI is not configured. Set "
                "DOUBOW_JOB_OPENING_ANALYZER_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY."
            ),
        )
    if err in {"missing_pivot", "missing_texts"}:
        msg = "Request must include a non-empty pivot and at least one non-empty job text in texts."
        raise HTTPException(status_code=400, detail=msg)
    if err:
        raise HTTPException(status_code=502, detail=f"Upstream error: {err}")
    return data
