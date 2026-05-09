from __future__ import annotations

import re
from datetime import datetime
from typing import Any

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn


def _parse_posted_at(raw: dict[str, Any]) -> datetime | None:
    dt = raw.get("date")
    if not isinstance(dt, str):
        return None
    try:
        return datetime.fromisoformat(dt.replace("Z", "+00:00"))
    except ValueError:
        return None


def raw_to_canonical_remoteok(raw: dict[str, Any]) -> CanonicalJobIn | None:
    company = (raw.get("company") or "").strip()
    position = (raw.get("position") or "").strip()
    if not company or not position:
        return None

    slug = (raw.get("slug") or "").strip()
    url = (raw.get("url") or "").strip()
    if not url and slug:
        url = f"https://remoteok.com/remote-jobs/{slug}"
    if not url:
        return None

    desc_raw = raw.get("description") or ""
    desc = re.sub(r"<[^>]+>", " ", str(desc_raw))
    desc = re.sub(r"\s+", " ", desc).strip()[:12000]

    tags_raw = raw.get("tags")
    tags: list[str] = []
    if isinstance(tags_raw, list):
        tags = [str(t) for t in tags_raw if isinstance(t, str)][:40]

    loc_str: str | None = None
    loc = raw.get("location")
    if isinstance(loc, str) and loc.strip():
        loc_str = loc.strip()[:220]

    rid = raw.get("id")
    ext = str(rid).strip()[:200] if rid is not None else None
    if not ext and slug:
        ext = slug[:200]

    return CanonicalJobIn(
        title=position[:220],
        company=company[:200],
        location=loc_str,
        description=desc or None,
        apply_url=url[:1000],
        listing_source="remoteok",
        employment_type="Remote",
        seniority=None,
        tags=tags,
        external_ref=ext,
        source_posted_at=_parse_posted_at(raw),
    )


def fetch_remoteok_canonical(max_rows: int) -> tuple[list[CanonicalJobIn], str | None]:
    """HTTP fetch Remote OK JSON → canonical rows. Error string when fetch/parse fails."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; DoubowJobBot/1.0)",
        "Accept": "application/json",
    }
    try:
        resp = httpx.get(settings.remoteok_api_url, timeout=60.0, headers=headers)
        resp.raise_for_status()
    except Exception as e:
        return [], repr(e)

    try:
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    if isinstance(data, dict) and isinstance(data.get("jobs"), list):
        items: list[Any] = list(data["jobs"])
    elif isinstance(data, list):
        items = list(data)
    else:
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    for raw in items:
        if len(out) >= max_rows:
            break
        if not isinstance(raw, dict):
            continue
        c = raw_to_canonical_remoteok(raw)
        if c is not None:
            out.append(c)
    return out, None


class RemoteOkAdapter:
    """Concrete adapter implementing :class:`ProviderAdapter` protocol."""

    listing_source = "remoteok"

    def fetch_canonical(self, *, max_rows: int) -> list[CanonicalJobIn]:
        jobs, err = fetch_remoteok_canonical(max_rows)
        if err:
            return []
        return jobs
