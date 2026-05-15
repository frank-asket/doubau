"""Glassdoor Real-time (RapidAPI) — company / interview / jobs / salary enrichment.

Subscribe: https://rapidapi.com/ptf/ptf-default/api/glassdoor-real-time (listing may vary).

Examples: GET ``/companies/interview-details?interviewId=…`` plus configurable category paths on
``glassdoor-real-time.p.rapidapi.com``.

Set ``DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY`` or reuse ``DOUBOW_RAPIDAPI_KEY`` /
``DOUBOW_JSEARCH_RAPIDAPI_KEY``.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.settings import settings

_PATH_INTERVIEW_DETAILS = "/companies/interview-details"

_PATH_BY_RESOURCE = {
    "conversations": "glassdoor_realtime_conversations_path",
    "jobs": "glassdoor_realtime_jobs_path",
    "job_details": "glassdoor_realtime_job_details_path",
    "companies": "glassdoor_realtime_companies_path",
    "company_details": "glassdoor_realtime_company_details_path",
    "company_reviews": "glassdoor_realtime_company_reviews_path",
    "company_interviews": "glassdoor_realtime_company_interviews_path",
    "interview_details": "glassdoor_realtime_interview_details_path",
    "salaries": "glassdoor_realtime_salaries_path",
}


def _glassdoor_realtime_api_key() -> str | None:
    k = (
        settings.glassdoor_realtime_rapidapi_key
        or settings.jsearch_rapidapi_key
        or settings.rapidapi_key
    )
    return k.strip() if isinstance(k, str) and k.strip() else None


def _headers() -> dict[str, str] | None:
    key = _glassdoor_realtime_api_key()
    if not key:
        return None
    host = (
        settings.glassdoor_realtime_rapidapi_host or "glassdoor-real-time.p.rapidapi.com"
    ).strip()
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": host,
    }


def _base_url() -> str:
    host = (
        settings.glassdoor_realtime_rapidapi_host or "glassdoor-real-time.p.rapidapi.com"
    ).strip()
    return f"https://{host}"


def _clean_path(path: str) -> str:
    p = (path or "").strip()
    if not p.startswith("/"):
        p = f"/{p}"
    return p


def _clean_params(params: dict[str, str | None]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in params.items():
        key = (k or "").strip()
        val = (v or "").strip() if isinstance(v, str) else ""
        if not key or val == "":
            continue
        out[key[:80]] = val[:2000]
    return out


def fetch_glassdoor_realtime_resource(
    resource: str,
    params: dict[str, str | None],
) -> tuple[Any | None, str | None]:
    """GET one configured Glassdoor Real-time resource and pass through parsed JSON.

    Resource names are controlled by ``_PATH_BY_RESOURCE`` so callers cannot proxy
    arbitrary upstream paths.
    Query params are passed through because RapidAPI endpoint shapes vary by plan/version.
    """
    key = (resource or "").strip()
    setting_name = _PATH_BY_RESOURCE.get(key)
    if not setting_name:
        return None, "unsupported_glassdoor_realtime_resource"

    hdr = _headers()
    if not hdr:
        return None, "missing_glassdoor_realtime_credentials"

    path = _clean_path(str(getattr(settings, setting_name, "") or ""))
    try:
        resp = httpx.get(
            f"{_base_url()}{path}",
            params=_clean_params(params),
            headers=hdr,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json(), None
    except httpx.HTTPStatusError as e:
        body = ""
        try:
            body = (e.response.text or "")[:500]
        except Exception:
            pass
        return None, f"http_{e.response.status_code}:{body or str(e)}"
    except Exception as e:
        return None, repr(e)[:500]


def fetch_company_interview_details(interview_id: str) -> tuple[Any | None, str | None]:
    """GET ``/companies/interview-details`` — returns parsed JSON (shape varies by upstream)."""
    iid = (interview_id or "").strip()
    if not iid:
        return None, "missing_interview_id"
    if not iid.isdigit():
        return None, "invalid_interview_id"

    hdr = _headers()
    if not hdr:
        return None, "missing_glassdoor_realtime_credentials"

    path = _clean_path(
        settings.glassdoor_realtime_interview_details_path or _PATH_INTERVIEW_DETAILS
    )

    try:
        resp = httpx.get(
            f"{_base_url()}{path}",
            params={"interviewId": iid[:24]},
            headers=hdr,
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json(), None
    except httpx.HTTPStatusError as e:
        body = ""
        try:
            body = (e.response.text or "")[:500]
        except Exception:
            pass
        return None, f"http_{e.response.status_code}:{body or str(e)}"
    except Exception as e:
        return None, repr(e)[:500]
