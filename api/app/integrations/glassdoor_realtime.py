"""Glassdoor Real-time (RapidAPI) — company / interview enrichment.

Subscribe: https://rapidapi.com/ptf/ptf-default/api/glassdoor-real-time (listing may vary).

Example: GET ``/companies/interview-details?interviewId=…`` on ``glassdoor-real-time.p.rapidapi.com``.

Set ``DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY`` or reuse ``DOUBOW_RAPIDAPI_KEY`` / ``DOUBOW_JSEARCH_RAPIDAPI_KEY``.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.settings import settings

_PATH_INTERVIEW_DETAILS = "/companies/interview-details"


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
    host = (settings.glassdoor_realtime_rapidapi_host or "glassdoor-real-time.p.rapidapi.com").strip()
    return {"X-RapidAPI-Key": key, "X-RapidAPI-Host": host}


def _base_url() -> str:
    host = (settings.glassdoor_realtime_rapidapi_host or "glassdoor-real-time.p.rapidapi.com").strip()
    return f"https://{host}"


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

    path = (settings.glassdoor_realtime_interview_details_path or _PATH_INTERVIEW_DETAILS).strip()
    if not path.startswith("/"):
        path = f"/{path}"

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
