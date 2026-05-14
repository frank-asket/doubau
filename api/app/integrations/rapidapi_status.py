"""Non-secret snapshot of which RapidAPI-backed integrations have credentials configured."""

from __future__ import annotations

from typing import Any

from app.core.settings import settings


def _non_empty(s: str | None) -> bool:
    return isinstance(s, str) and bool(s.strip())


def rapidapi_integration_status() -> dict[str, Any]:
    """Return booleans only (no keys, hosts, or URLs)."""
    shared = _non_empty(settings.rapidapi_key)
    jk = _non_empty(settings.jsearch_rapidapi_key)
    ajd = _non_empty(settings.active_jobs_db_rapidapi_key)
    gd = _non_empty(settings.glassdoor_realtime_rapidapi_key)
    joa = _non_empty(settings.job_opening_analyzer_rapidapi_key)

    return {
        "shared_rapidapi_key_configured": shared,
        "jsearch_configured": jk or shared,
        "active_jobs_db_configured": ajd or jk or shared,
        "glassdoor_realtime_configured": gd or jk or shared,
        "job_opening_analyzer_configured": joa or jk or shared,
    }
