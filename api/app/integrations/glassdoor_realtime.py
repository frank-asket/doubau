"""Glassdoor Real-time (RapidAPI) — company / interview / jobs / salary enrichment.

Subscribe: https://rapidapi.com/ptf/ptf-default/api/glassdoor-real-time (listing may vary).

Examples: GET ``/companies/interview-details?interviewId=…`` plus configurable category paths on
``glassdoor-real-time.p.rapidapi.com``.

Set ``DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY`` or reuse ``DOUBOW_RAPIDAPI_KEY`` /
``DOUBOW_JSEARCH_RAPIDAPI_KEY``.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
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


def normalize_company_key(name: str) -> str:
    """Stable key for company enrichment deduplication."""
    s = re.sub(r"[^a-z0-9]+", " ", (name or "").lower()).strip()
    return re.sub(r"\s+", " ", s)[:220]


def _walk(obj: Any) -> list[Any]:
    out: list[Any] = []
    if isinstance(obj, Mapping):
        out.append(obj)
        for v in obj.values():
            out.extend(_walk(v))
    elif isinstance(obj, Sequence) and not isinstance(obj, (str, bytes, bytearray)):
        for v in obj[:20]:
            out.extend(_walk(v))
    return out


def _first_mapping_list(obj: Any) -> list[dict[str, Any]]:
    if isinstance(obj, list):
        rows = [x for x in obj if isinstance(x, dict)]
        if rows:
            return rows
    if isinstance(obj, Mapping):
        for key in ("data", "results", "companies", "employers", "items", "records"):
            rows = _first_mapping_list(obj.get(key))
            if rows:
                return rows
    return []


def _first_str(row: Mapping[str, Any], *keys: str, max_len: int = 2000) -> str | None:
    for key in keys:
        v = row.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()[:max_len]
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            return str(v)[:max_len]
    return None


def _first_num(row: Mapping[str, Any], *keys: str) -> float | None:
    for key in keys:
        v = row.get(key)
        try:
            if isinstance(v, bool) or v is None:
                continue
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def _first_int(row: Mapping[str, Any], *keys: str) -> int | None:
    n = _first_num(row, *keys)
    return int(n) if n is not None else None


def glassdoor_company_summary(company_name: str, payload: Any) -> dict[str, Any]:
    """Extract durable employer fields from variable Glassdoor Real-time payloads."""
    rows = _first_mapping_list(payload)
    candidates = rows or [x for x in _walk(payload) if isinstance(x, Mapping)]
    target = normalize_company_key(company_name)
    chosen: Mapping[str, Any] = {}
    for row in candidates:
        name = _first_str(
            row,
            "name",
            "employerName",
            "employer_name",
            "companyName",
            "company_name",
            "shortName",
            max_len=220,
        )
        if name and normalize_company_key(name) == target:
            chosen = row
            break
    if not chosen and candidates:
        chosen = candidates[0]

    name = _first_str(
        chosen,
        "name",
        "employerName",
        "employer_name",
        "companyName",
        "company_name",
        "shortName",
        max_len=220,
    )
    provider_ref = _first_str(
        chosen,
        "id",
        "employerId",
        "employer_id",
        "companyId",
        "company_id",
        "glassdoorId",
        max_len=120,
    )
    logo = _first_str(
        chosen,
        "squareLogoUrl",
        "logoUrl",
        "logo_url",
        "employerLogo",
        "employer_logo",
        max_len=2000,
    )
    website = _first_str(
        chosen,
        "website",
        "websiteUrl",
        "website_url",
        "employerWebsite",
        "employer_website",
        max_len=2000,
    )

    return {
        "company_name": (name or company_name).strip()[:220],
        "provider_ref": provider_ref,
        "logo_url": logo if logo and logo.startswith(("http://", "https://")) else None,
        "website_url": website if website and website.startswith(("http://", "https://")) else None,
        "rating": _first_num(chosen, "rating", "overallRating", "overall_rating"),
        "review_count": _first_int(chosen, "reviewCount", "review_count", "reviewsCount"),
        "interview_count": _first_int(
            chosen,
            "interviewCount",
            "interview_count",
            "interviewsCount",
        ),
    }


def glassdoor_interview_company_summary(interview_id: str, payload: Any) -> dict[str, Any]:
    """Extract employer fields from ``/companies/interview-details`` payload."""
    detail = None
    if isinstance(payload, Mapping):
        data = payload.get("data")
        if isinstance(data, Mapping):
            maybe = data.get("employerInterviewDetails") or data.get("interview")
            if isinstance(maybe, Mapping):
                detail = maybe
    if detail is None:
        for row in _walk(payload):
            if isinstance(row, Mapping) and isinstance(row.get("employer"), Mapping):
                detail = row
                break

    employer = detail.get("employer") if isinstance(detail, Mapping) else None
    if not isinstance(employer, Mapping):
        employer = {}

    name = _first_str(
        employer,
        "name",
        "employerName",
        "companyName",
        max_len=220,
    )
    provider_ref = _first_str(
        employer,
        "id",
        "employerId",
        "companyId",
        max_len=120,
    )
    logo = _first_str(
        employer,
        "squareLogoUrl",
        "logoUrl",
        "logo_url",
        max_len=2000,
    )
    return {
        "company_name": (name or f"Glassdoor interview {interview_id}").strip()[:220],
        "provider_ref": provider_ref,
        "logo_url": logo if logo and logo.startswith(("http://", "https://")) else None,
        "website_url": None,
        "rating": _first_num(employer, "rating", "overallRating", "overall_rating"),
        "review_count": _first_int(employer, "reviewCount", "review_count", "reviewsCount"),
        "interview_count": _first_int(
            employer,
            "interviewCount",
            "interview_count",
            "interviewsCount",
        ),
    }


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
