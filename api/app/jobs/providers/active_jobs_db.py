"""Active Jobs DB (RapidAPI / Fantastic Jobs) — hourly ATS + career-site postings.

Subscribe: https://rapidapi.com/fantastic-jobs-fantastic-jobs-default/api/active-jobs-db

GET ``/active-ats-1h`` (and related paths) on ``active-jobs-db.p.rapidapi.com`` with the usual
``X-RapidAPI-Key`` / ``X-RapidAPI-Host`` headers. Query params include ``offset``, ``title_filter``,
``location_filter``, and ``description_type`` (``text`` or ``html``).

Set ``DOUBOW_ACTIVE_JOBS_DB_RAPIDAPI_KEY`` or reuse ``DOUBOW_RAPIDAPI_KEY`` / ``DOUBOW_JSEARCH_RAPIDAPI_KEY``.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn

LISTING_SOURCE = "active_jobs_db"


def _strip_html(text: str, max_len: int = 12000) -> str:
    s = re.sub(r"<[^>]+>", " ", text)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len] if s else ""


def _parse_datetime(raw: object) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        try:
            v = float(raw)
            if v > 1e12:
                v = v / 1000.0
            return datetime.fromtimestamp(v, tz=UTC)
        except (OSError, OverflowError, ValueError):
            return None
    if isinstance(raw, str) and raw.strip():
        s = raw.strip()
        if s.endswith("Z") and "+" not in s and s.count("-") >= 2:
            s_iso = s[:-1] + "+00:00"
        else:
            s_iso = s
        try:
            dt = datetime.fromisoformat(s_iso)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=UTC)
            return dt.astimezone(UTC)
        except ValueError:
            for fmt in (
                "%Y-%m-%dT%H:%M:%S.%f%z",
                "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%d %H:%M:%S%z",
            ):
                try:
                    dt2 = datetime.strptime(s[:32], fmt)
                    if dt2.tzinfo is None:
                        return dt2.replace(tzinfo=UTC)
                    return dt2.astimezone(UTC)
                except ValueError:
                    continue
            return None
    return None


def _locations_derived_to_str(raw: object) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, str) and raw.strip():
        return raw.strip()[:220]
    if isinstance(raw, list):
        parts: list[str] = []
        for item in raw[:12]:
            if isinstance(item, str) and item.strip():
                parts.append(item.strip())
            elif isinstance(item, dict):
                city = str(item.get("city") or "").strip()
                admin = str(item.get("admin") or item.get("state") or "").strip()
                country = str(item.get("country") or "").strip()
                seg = ", ".join(x for x in (city, admin, country) if x)
                if seg:
                    parts.append(seg)
        return ", ".join(parts)[:220] if parts else None
    return None


def raw_to_canonical_active_jobs_db(raw: dict[str, Any]) -> CanonicalJobIn | None:
    """Map Fantastic Jobs-style JSON to ``CanonicalJobIn``."""
    title = (raw.get("title") or raw.get("job_title") or "").strip()
    company = (raw.get("organization") or raw.get("employer_name") or raw.get("company") or "").strip()
    link = (raw.get("url") or raw.get("job_apply_link") or raw.get("apply_url") or "").strip()
    if not title or not company or not link:
        return None

    desc = None
    desc_text = raw.get("description_text")
    desc_html = raw.get("description_html")
    if isinstance(desc_text, str) and desc_text.strip():
        desc = desc_text.strip()[:12000]
    elif isinstance(desc_html, str) and desc_html.strip():
        desc = _strip_html(desc_html)

    location = _locations_derived_to_str(raw.get("locations_derived"))
    if not location:
        loc_raw = raw.get("locations_raw")
        if isinstance(loc_raw, list) and loc_raw:
            location = _locations_derived_to_str(loc_raw)

    employment_type = None
    et = raw.get("employment_type")
    if isinstance(et, list) and et:
        employment_type = str(et[0]).strip()[:80] if et[0] is not None else None
    elif isinstance(et, str) and et.strip():
        employment_type = et.strip()[:80]

    tags: list[str] = []
    src = raw.get("source")
    if isinstance(src, str) and src.strip():
        tags.append(src.strip()[:80])
    st = raw.get("source_type")
    if isinstance(st, str) and st.strip():
        tags.append(st.strip()[:40])
    if raw.get("remote_derived") is True or raw.get("location_type") == "TELECOMMUTE":
        tags.append("remote")

    seniority = None
    ai_xp = raw.get("ai_experience_level")
    if isinstance(ai_xp, str) and ai_xp.strip():
        seniority = ai_xp.strip()[:80]

    ext = raw.get("id")
    ext_s = str(ext).strip()[:200] if ext is not None else None

    posted = _parse_datetime(raw.get("date_posted")) or _parse_datetime(raw.get("date_created"))

    return CanonicalJobIn(
        title=title[:220],
        company=company[:200],
        location=location,
        description=desc,
        apply_url=link[:1000],
        listing_source=LISTING_SOURCE,
        employment_type=employment_type,
        seniority=seniority,
        tags=tags[:40],
        external_ref=ext_s,
        source_posted_at=posted,
    )


def _active_jobs_db_api_key() -> str | None:
    k = (
        settings.active_jobs_db_rapidapi_key
        or settings.jsearch_rapidapi_key
        or settings.rapidapi_key
    )
    return k.strip() if isinstance(k, str) and k.strip() else None


def _active_jobs_db_headers() -> dict[str, str] | None:
    key = _active_jobs_db_api_key()
    if not key:
        return None
    host = (settings.active_jobs_db_rapidapi_host or "active-jobs-db.p.rapidapi.com").strip()
    return {"X-RapidAPI-Key": key, "X-RapidAPI-Host": host}


def _active_jobs_db_base_url() -> str:
    host = (settings.active_jobs_db_rapidapi_host or "active-jobs-db.p.rapidapi.com").strip()
    return f"https://{host}"


def _rows_from_payload(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if not isinstance(data, dict):
        return []
    for key in ("jobs", "results", "items", "data", "listings"):
        inner = data.get(key)
        if isinstance(inner, list):
            return [x for x in inner if isinstance(x, dict)]
    if any(k in data for k in ("title", "organization", "url")):
        return [data]
    return []


def _get_json(path: str, params: dict[str, Any]) -> tuple[Any | None, str | None]:
    headers = _active_jobs_db_headers()
    if not headers:
        return None, "missing_active_jobs_db_credentials"
    p = path if path.startswith("/") else f"/{path}"
    clean: dict[str, Any] = {}
    for k, v in params.items():
        if v is None:
            continue
        if isinstance(v, str) and not v.strip():
            continue
        clean[k] = v
    try:
        resp = httpx.get(f"{_active_jobs_db_base_url()}{p}", params=clean, headers=headers, timeout=90.0)
        resp.raise_for_status()
        return resp.json(), None
    except Exception as e:
        return None, repr(e)


def _phrase_title_filter(q: str) -> str:
    """Wrap a plain search string in quotes for phrase style filters when not already quoted."""
    s = q.strip()[:400]
    if not s:
        return ""
    if (s.startswith('"') and s.endswith('"')) or (" OR " in s.upper()):
        return s
    inner = s.replace('"', "")
    return f'"{inner}"' if inner else ""


def fetch_active_jobs_db_canonical(
    max_rows: int,
    *,
    title_filter_override: str | None = None,
    location_filter_override: str | None = None,
) -> tuple[list[CanonicalJobIn], str | None]:
    """GET configured Active Jobs DB path (default ``/active-ats-1h``) → canonical rows."""
    if not _active_jobs_db_api_key():
        return [], "missing_active_jobs_db_credentials"

    cap = max(1, min(max_rows, settings.active_jobs_db_ingest_max_jobs))
    path = (settings.active_jobs_db_path or "/active-ats-1h").strip()
    if not path.startswith("/"):
        path = f"/{path}"

    title_f = (title_filter_override or "").strip() or (settings.active_jobs_db_title_filter or "").strip()
    loc_f = (location_filter_override or "").strip() or (settings.active_jobs_db_location_filter or "").strip()
    desc_type = (settings.active_jobs_db_description_type or "text").strip().lower()[:16]
    if desc_type not in {"text", "html"}:
        desc_type = "text"

    out: list[CanonicalJobIn] = []
    offset = 0
    pages = 0
    while len(out) < cap and pages < 25:
        pages += 1
        params: dict[str, Any] = {
            "offset": offset,
            "description_type": desc_type,
        }
        if title_f:
            params["title_filter"] = title_f[:2000]
        if loc_f:
            params["location_filter"] = loc_f[:2000]

        data, err = _get_json(path, params)
        if err or data is None:
            return out if out else ([], err or "fetch_failed")

        if isinstance(data, dict) and (data.get("message") or data.get("error")):
            msg = str(data.get("message") or data.get("error"))[:500]
            return out if out else ([], msg)

        rows = _rows_from_payload(data)
        if not rows:
            break

        for raw in rows:
            if len(out) >= cap:
                break
            c = raw_to_canonical_active_jobs_db(raw)
            if c is not None:
                out.append(c)

        offset += len(rows)

    if not out:
        return [], "unexpected_shape"
    return out, None


def title_filter_from_catalog_query(q: str) -> str:
    """Build a ``title_filter`` value from a free-text catalog query (JSearch-style string)."""
    return _phrase_title_filter(q)
