"""JSearch (RapidAPI) — multi-board job search without scraping LinkedIn/Indeed directly.

Subscribe: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

RapidAPI exposes these GET routes on ``jsearch.p.rapidapi.com`` (same ``X-RapidAPI-*`` headers):

- ``/search-v2`` — Job Search V2 (preferred for new integrations; see ``DOUBOW_JSEARCH_JOB_SEARCH_ENDPOINT``).
- ``/search`` — Job Search (classic).
- ``/job-details`` — full job payload by ``job_id``.
- ``/estimated-salary`` — salary bands by job title + location.
- ``/company-job-salary`` — salary bands for a job title at a specific company.

Set ``DOUBOW_JSEARCH_RAPIDAPI_KEY`` (or ``DOUBOW_RAPIDAPI_KEY``) and optional host/query/country in settings.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn

# --- Paths (RapidAPI “Endpoints” tab on JSearch) ---
JSEARCH_PATH_JOB_SEARCH = "/search"
JSEARCH_PATH_JOB_SEARCH_V2 = "/search-v2"
JSEARCH_PATH_JOB_DETAILS = "/job-details"
JSEARCH_PATH_ESTIMATED_SALARY = "/estimated-salary"
JSEARCH_PATH_COMPANY_JOB_SALARY = "/company-job-salary"


def _strip_html(text: str, max_len: int = 12000) -> str:
    s = re.sub(r"<[^>]+>", " ", text)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len] if s else ""


def _posted_at(raw: dict[str, Any]) -> datetime | None:
    ts = raw.get("job_posted_at_timestamp")
    if ts is None:
        ts = raw.get("job_posted_at_timestamp_ms")
    if ts is None:
        return None
    try:
        v = float(ts)
        if v > 1e12:
            v = v / 1000.0
        return datetime.fromtimestamp(v, tz=UTC)
    except (OSError, OverflowError, TypeError, ValueError):
        return None


def raw_to_canonical_jsearch(raw: dict[str, Any]) -> CanonicalJobIn | None:
    title = (raw.get("job_title") or "").strip()
    company = (raw.get("employer_name") or "").strip()
    link = (raw.get("job_apply_link") or "").strip()
    if not title or not company or not link:
        return None

    desc_raw = raw.get("job_description")
    description = None
    if isinstance(desc_raw, str) and desc_raw.strip():
        description = _strip_html(desc_raw)

    loc_parts: list[str] = []
    for key in ("job_city", "job_state", "job_country"):
        v = raw.get(key)
        if isinstance(v, str) and v.strip():
            loc_parts.append(v.strip())
    location = ", ".join(loc_parts)[:220] if loc_parts else None

    et = raw.get("job_employment_type")
    employment_type = et.strip()[:80] if isinstance(et, str) and et.strip() else None

    publisher = (raw.get("job_publisher") or "").strip()
    tags: list[str] = []
    if publisher:
        tags.append(publisher[:80])
    if raw.get("job_is_remote") is True:
        tags.append("remote")

    jid = raw.get("job_id")
    ext = str(jid)[:200] if jid is not None else None

    return CanonicalJobIn(
        title=title[:220],
        company=company[:200],
        location=location,
        description=description,
        apply_url=link[:1000],
        listing_source="jsearch",
        employment_type=employment_type,
        seniority=None,
        tags=tags[:40],
        external_ref=ext,
        source_posted_at=_posted_at(raw),
    )


def _jsearch_api_key() -> str | None:
    k = settings.jsearch_rapidapi_key or settings.rapidapi_key
    return k.strip() if isinstance(k, str) and k.strip() else None


def _jsearch_headers() -> dict[str, str] | None:
    key = _jsearch_api_key()
    if not key:
        return None
    host = (settings.jsearch_rapidapi_host or "jsearch.p.rapidapi.com").strip()
    return {"X-RapidAPI-Key": key, "X-RapidAPI-Host": host}


def _jsearch_url(path: str) -> str:
    host = (settings.jsearch_rapidapi_host or "jsearch.p.rapidapi.com").strip()
    p = path if path.startswith("/") else f"/{path}"
    return f"https://{host}{p}"


def _jsearch_get_json(path: str, params: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    """GET a JSearch JSON envelope ``{status, request_id, data|error}``."""
    headers = _jsearch_headers()
    if not headers:
        return None, "missing_jsearch_credentials"

    clean_params: dict[str, Any] = {}
    for k, v in params.items():
        if v is None:
            continue
        if isinstance(v, bool):
            clean_params[k] = "true" if v else "false"
        elif isinstance(v, str) and not v.strip():
            continue
        else:
            clean_params[k] = v

    try:
        resp = httpx.get(_jsearch_url(path), params=clean_params, headers=headers, timeout=90.0)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return None, repr(e)

    if not isinstance(data, dict):
        return None, "unexpected_shape"

    st = (data.get("status") or "").upper()
    if st == "ERROR":
        err = data.get("error")
        if isinstance(err, dict):
            return None, str(err.get("message") or err)[:500]
        return None, str(data.get("message") or err or st)[:500]

    return data, None


def _jsearch_search_job_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize ``data`` from Job Search / Job Search V2 into a list of job dicts."""
    raw = payload.get("data")
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        for key in ("jobs", "results", "items", "listings"):
            inner = raw.get(key)
            if isinstance(inner, list):
                return [x for x in inner if isinstance(x, dict)]
        if any(k in raw for k in ("job_id", "job_title", "job_apply_link")):
            return [raw]
    return []


def fetch_jsearch_canonical(max_rows: int, *, query_override: str | None = None) -> tuple[list[CanonicalJobIn], str | None]:
    """JSearch RapidAPI job search (``/search`` or ``/search-v2``) → canonical rows."""
    if not _jsearch_api_key():
        return [], "missing_jsearch_credentials"

    endpoint = settings.jsearch_job_search_endpoint
    path = JSEARCH_PATH_JOB_SEARCH_V2 if endpoint == "search-v2" else JSEARCH_PATH_JOB_SEARCH

    num_pages = max(1, min(settings.jsearch_num_pages, 20))
    country = (settings.jsearch_country or "us").strip().lower()[:8]
    query = (query_override or "").strip() or (settings.jsearch_query or "").strip() or "open roles"
    date_posted = (settings.jsearch_date_posted or "all").strip().lower()[:16]
    if date_posted not in {"all", "today", "3days", "week", "month"}:
        date_posted = "all"

    params: dict[str, Any] = {
        "query": query[:400],
        "page": 1,
        "num_pages": num_pages,
        "country": country,
        "date_posted": date_posted,
    }
    lang = (settings.jsearch_language or "").strip()[:16]
    if lang:
        params["language"] = lang

    data, err = _jsearch_get_json(path, params)
    if err or data is None:
        return [], err or "fetch_failed"

    rows = _jsearch_search_job_rows(data)
    if not rows:
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    cap = max(1, min(max_rows, settings.jsearch_ingest_max_jobs))
    for raw in rows:
        if len(out) >= cap:
            break
        c = raw_to_canonical_jsearch(raw)
        if c is not None:
            out.append(c)
    return out, None


def fetch_jsearch_job_details_json(
    job_id: str,
    *,
    country: str | None = "us",
    language: str | None = "en",
    fields: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """GET ``/job-details`` — full job record (and optional field projection)."""
    jid = (job_id or "").strip()
    if not jid:
        return None, "missing_job_id"

    params: dict[str, Any] = {"job_id": jid}
    if country is not None and str(country).strip():
        params["country"] = str(country).strip()[:8]
    if language is not None and str(language).strip():
        params["language"] = str(language).strip()[:16]
    if fields and fields.strip():
        params["fields"] = fields.strip()[:2000]

    return _jsearch_get_json(JSEARCH_PATH_JOB_DETAILS, params)


def fetch_jsearch_estimated_salary_json(
    *,
    job_title: str,
    location: str,
    location_type: str | None = None,
    years_of_experience: str | None = None,
    fields: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """GET ``/estimated-salary`` — salary estimates for a title in a location."""
    jt = (job_title or "").strip()
    loc = (location or "").strip()
    if not jt or not loc:
        return None, "missing_job_title_or_location"

    params: dict[str, Any] = {"job_title": jt[:400], "location": loc[:400]}
    if location_type and location_type.strip():
        params["location_type"] = location_type.strip()[:32]
    if years_of_experience and years_of_experience.strip():
        params["years_of_experience"] = years_of_experience.strip()[:48]
    if fields and fields.strip():
        params["fields"] = fields.strip()[:2000]

    return _jsearch_get_json(JSEARCH_PATH_ESTIMATED_SALARY, params)


def fetch_jsearch_company_job_salary_json(
    *,
    company: str,
    job_title: str,
    location: str | None = None,
    location_type: str | None = None,
    years_of_experience: str | None = None,
    fields: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """GET ``/company-job-salary`` — salary estimates for a title at a given employer."""
    co = (company or "").strip()
    jt = (job_title or "").strip()
    if not co or not jt:
        return None, "missing_company_or_job_title"

    params: dict[str, Any] = {"company": co[:400], "job_title": jt[:400]}
    if location and location.strip():
        params["location"] = location.strip()[:400]
    if location_type and location_type.strip():
        params["location_type"] = location_type.strip()[:32]
    if years_of_experience and years_of_experience.strip():
        params["years_of_experience"] = years_of_experience.strip()[:48]
    if fields and fields.strip():
        params["fields"] = fields.strip()[:2000]

    return _jsearch_get_json(JSEARCH_PATH_COMPANY_JOB_SALARY, params)
