"""Authenticated proxies to third-party APIs (RapidAPI, etc.)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep
from app.integrations.glassdoor_realtime import (
    fetch_company_interview_details,
    fetch_glassdoor_realtime_resource,
)
from app.integrations.job_opening_analyzer import post_compute_similarity
from app.integrations.rapidapi_status import rapidapi_integration_status

router = APIRouter(prefix="/integrations", tags=["integrations"])


class RapidApiIntegrationStatusOut(BaseModel):
    """Which RapidAPI products have usable keys (shared or product-specific)."""

    shared_rapidapi_key_configured: bool
    jsearch_configured: bool
    active_jobs_db_configured: bool
    glassdoor_realtime_configured: bool
    job_opening_analyzer_configured: bool


@router.get("/rapidapi/status", response_model=RapidApiIntegrationStatusOut)
def rapidapi_status(current_user: CurrentUserDep) -> RapidApiIntegrationStatusOut:
    """Report RapidAPI credential coverage for debugging and admin UIs (no secrets)."""
    _ = current_user
    return RapidApiIntegrationStatusOut(**rapidapi_integration_status())


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
    """Proxy Glassdoor Real-time salary estimates."""
    title = (job_title or jobTitle or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Missing job_title.")
    cid = (company_id or companyId or "").strip()
    return _glassdoor_proxy(
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
