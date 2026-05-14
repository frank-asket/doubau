"""Authenticated proxies to third-party APIs (RapidAPI, etc.)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep
from app.integrations.glassdoor_realtime import fetch_company_interview_details
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
    """Body for RapidAPI Job Opening Analyzer ``compute_similarity`` (pivot = résumé/profile, texts = job JDs)."""

    pivot: str = Field(..., min_length=1, max_length=100_000, description="Reference text (e.g. résumé or candidate profile).")
    texts: list[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="Job opening texts to score against the pivot (upstream ``texts`` array).",
    )


@router.get("/glassdoor/companies/interview-details")
def glassdoor_company_interview_details(
    current_user: CurrentUserDep,
    interview_id: str = Query(
        ...,
        min_length=1,
        max_length=24,
        description="Numeric Glassdoor interview id (maps to upstream ``interviewId``).",
    ),
) -> Any:
    """Proxy to RapidAPI Glassdoor Real-time ``GET /companies/interview-details``.

    Requires a logged-in user. Configure ``DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY`` or a shared RapidAPI key.
    Response body is passed through from upstream (JSON object or array).
    """
    _ = current_user
    iid = interview_id.strip()
    if not iid.isdigit():
        raise HTTPException(status_code=400, detail="interview_id must be numeric.")

    data, err = fetch_company_interview_details(iid)
    if err == "missing_glassdoor_realtime_credentials":
        raise HTTPException(
            status_code=503,
            detail="Glassdoor Real-time RapidAPI is not configured. Set DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY.",
        )
    if err == "missing_interview_id" or err == "invalid_interview_id":
        raise HTTPException(status_code=400, detail="Invalid interview_id.")
    if err:
        raise HTTPException(status_code=502, detail=f"Upstream error: {err}")
    return data


@router.post("/job-opening-analyzer/compute-similarity")
def job_opening_analyzer_compute_similarity(
    current_user: CurrentUserDep,
    payload: JobOpeningAnalyzerSimilarityIn = Body(...),
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
            detail="Job Opening Analyzer RapidAPI is not configured. Set DOUBOW_JOB_OPENING_ANALYZER_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY.",
        )
    if err in {"missing_pivot", "missing_texts"}:
        msg = "Request must include a non-empty pivot and at least one non-empty job text in texts."
        raise HTTPException(status_code=400, detail=msg)
    if err:
        raise HTTPException(status_code=502, detail=f"Upstream error: {err}")
    return data
