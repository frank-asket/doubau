"""JSearch (RapidAPI) — multi-board job search without scraping LinkedIn/Indeed directly.

Subscribe: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
Set ``DOUBOW_JSEARCH_RAPIDAPI_KEY`` and optional query/country in settings.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn

_JSEARCH_PATH = "/search"


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


def fetch_jsearch_canonical(max_rows: int, *, query_override: str | None = None) -> tuple[list[CanonicalJobIn], str | None]:
    """JSearch RapidAPI ``/search`` → canonical rows."""
    key = settings.jsearch_rapidapi_key
    if not key:
        return [], "missing_jsearch_credentials"

    host = (settings.jsearch_rapidapi_host or "jsearch.p.rapidapi.com").strip()
    num_pages = max(1, min(settings.jsearch_num_pages, 20))
    country = (settings.jsearch_country or "us").strip().lower()[:8]
    query = (query_override or "").strip() or (settings.jsearch_query or "").strip() or "open roles"
    date_posted = (settings.jsearch_date_posted or "all").strip().lower()[:16]
    if date_posted not in {"all", "today", "3days", "week", "month"}:
        date_posted = "all"

    url = f"https://{host}{_JSEARCH_PATH}"
    headers = {"X-RapidAPI-Key": key.strip(), "X-RapidAPI-Host": host}
    params: dict[str, Any] = {
        "query": query[:400],
        "page": 1,
        "num_pages": num_pages,
        "country": country,
        "date_posted": date_posted,
    }

    try:
        resp = httpx.get(url, params=params, headers=headers, timeout=90.0)
        resp.raise_for_status()
    except Exception as e:
        return [], repr(e)

    try:
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    if not isinstance(data, dict):
        return [], "unexpected_shape"

    rows = data.get("data")
    if not isinstance(rows, list):
        return [], "unexpected_shape"

    st = (data.get("status") or "").upper()
    if st and st != "OK" and not rows:
        err = data.get("error") or data.get("message") or st
        return [], str(err)[:500]

    out: list[CanonicalJobIn] = []
    cap = max(1, min(max_rows, settings.jsearch_ingest_max_jobs))
    for raw in rows:
        if len(out) >= cap:
            break
        if not isinstance(raw, dict):
            continue
        c = raw_to_canonical_jsearch(raw)
        if c is not None:
            out.append(c)
    return out, None
