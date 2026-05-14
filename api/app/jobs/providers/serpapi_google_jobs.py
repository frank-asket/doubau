"""SerpAPI Google Jobs engine — structured listings (many apply links go to ATS / job boards).

https://serpapi.com/google-jobs-api — set ``DOUBOW_SERPAPI_API_KEY``.
This is not HTML scraping of LinkedIn/Indeed; SerpAPI returns JSON for ``engine=google_jobs``.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn

_SERPAPI_URL = "https://serpapi.com/search.json"


def _strip_html(text: str, max_len: int = 12000) -> str:
    s = re.sub(r"<[^>]+>", " ", text)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len] if s else ""


def _apply_url(raw: dict[str, Any]) -> str:
    opts = raw.get("apply_options")
    if isinstance(opts, list):
        for o in opts:
            if isinstance(o, dict):
                link = (o.get("link") or "").strip()
                if link.startswith("http"):
                    return link[:1000]
    for key in ("job_link", "share_link", "search_link"):
        v = raw.get(key)
        if isinstance(v, str) and v.strip().startswith("http"):
            return v.strip()[:1000]
    return ""


def _posted_at(raw: dict[str, Any]) -> datetime | None:
    ts = raw.get("detected_extensions", {})
    if isinstance(ts, dict):
        for k in ("posted_at", "posted_at_timestamp_s", "date_posted"):
            v = ts.get(k)
            if isinstance(v, (int, float)):
                try:
                    return datetime.fromtimestamp(float(v), tz=UTC)
                except (OSError, OverflowError, ValueError):
                    pass
    return None


def raw_to_canonical_serpapi_google_job(raw: dict[str, Any]) -> CanonicalJobIn | None:
    title = (raw.get("title") or "").strip()
    company = (raw.get("company_name") or "").strip()
    link = _apply_url(raw)
    if not title or not company or not link:
        return None

    desc_raw = raw.get("description")
    description = None
    if isinstance(desc_raw, str) and desc_raw.strip():
        description = _strip_html(desc_raw)

    location = (raw.get("location") or "").strip()[:220] or None

    via = (raw.get("via") or "").strip()
    tags: list[str] = []
    if via:
        tags.append(via[:80])

    ext = None
    for key in ("job_id", "detected_extensions"):
        if key == "job_id":
            jid = raw.get("job_id")
            if jid is not None:
                ext = str(jid)[:200]
                break
        else:
            de = raw.get("detected_extensions")
            if isinstance(de, dict) and de.get("job_id") is not None:
                ext = str(de.get("job_id"))[:200]
                break

    return CanonicalJobIn(
        title=title[:220],
        company=company[:200],
        location=location,
        description=description,
        apply_url=link,
        listing_source="serpapi_google_jobs",
        employment_type=None,
        seniority=None,
        tags=tags[:40],
        external_ref=ext,
        source_posted_at=_posted_at(raw),
    )


def fetch_serpapi_google_jobs_canonical(
    max_rows: int, *, query_override: str | None = None
) -> tuple[list[CanonicalJobIn], str | None]:
    """SerpAPI ``engine=google_jobs`` → canonical rows."""
    api_key = settings.serpapi_api_key
    if not api_key:
        return [], "missing_serpapi_credentials"

    q = (query_override or "").strip() or (settings.serpapi_google_jobs_query or "").strip() or "open roles"
    num = max(1, min(max_rows, settings.serpapi_ingest_max_jobs, 100))
    params: dict[str, Any] = {
        "engine": "google_jobs",
        "q": q[:400],
        "api_key": api_key.strip(),
        "hl": (settings.serpapi_google_jobs_hl or "en").strip()[:16] or "en",
        "num": num,
    }
    loc = (settings.serpapi_google_jobs_location or "").strip()
    if loc:
        params["location"] = loc[:200]

    try:
        resp = httpx.get(_SERPAPI_URL, params=params, timeout=90.0)
        resp.raise_for_status()
    except Exception as e:
        return [], repr(e)

    try:
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    if not isinstance(data, dict):
        return [], "unexpected_shape"

    if data.get("error"):
        return [], str(data.get("error"))[:500]

    rows = data.get("jobs_results")
    if not isinstance(rows, list):
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    cap = max(1, min(max_rows, settings.serpapi_ingest_max_jobs))
    for raw in rows:
        if len(out) >= cap:
            break
        if not isinstance(raw, dict):
            continue
        c = raw_to_canonical_serpapi_google_job(raw)
        if c is not None:
            out.append(c)
    return out, None
