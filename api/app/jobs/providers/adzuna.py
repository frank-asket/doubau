from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn


def _parse_adzuna_created(value: object) -> datetime | None:
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=UTC)
        except (OverflowError, OSError, ValueError):
            return None
    return None


def raw_to_canonical_adzuna(raw: dict[str, Any]) -> CanonicalJobIn | None:
    title = (raw.get("title") or "").strip()
    if not title:
        return None

    company_block = raw.get("company")
    company = ""
    if isinstance(company_block, dict):
        company = (company_block.get("display_name") or "").strip()
    elif isinstance(company_block, str):
        company = company_block.strip()
    if not company:
        return None

    url = (raw.get("redirect_url") or raw.get("url") or "").strip()
    if not url:
        return None

    desc = raw.get("description")
    description = None
    if isinstance(desc, str) and desc.strip():
        description = desc.strip()[:12000]

    location_parts: list[str] = []
    for la in raw.get("location_area") or []:
        if isinstance(la, dict):
            dn = la.get("display_name")
            if isinstance(dn, str) and dn.strip():
                location_parts.append(dn.strip())
    location = ", ".join(location_parts)[:220] if location_parts else None

    contract = raw.get("contract_type")
    if isinstance(contract, str) and contract.strip():
        employment_type = contract.strip()[:80]
    else:
        employment_type = None

    jid = raw.get("id")
    ext = str(jid)[:200] if jid is not None else None

    posted = _parse_adzuna_created(raw.get("created"))

    return CanonicalJobIn(
        title=title[:220],
        company=company[:200],
        location=location,
        description=description,
        apply_url=url[:1000],
        listing_source="adzuna",
        employment_type=employment_type,
        seniority=None,
        tags=[],
        external_ref=ext,
        source_posted_at=posted,
    )


def fetch_adzuna_canonical(max_rows: int) -> tuple[list[CanonicalJobIn], str | None]:
    """Adzuna REST API → canonical rows. Requires ``DOUBOW_ADZUNA_APP_ID`` / ``APP_KEY``."""
    app_id = settings.adzuna_app_id
    app_key = settings.adzuna_app_key
    if not app_id or not app_key:
        return [], "missing_adzuna_credentials"

    country = (settings.adzuna_country_code or "gb").strip().lower()
    limit = max(1, min(max_rows, settings.adzuna_max_results, 50))
    params: dict[str, Any] = {
        "app_id": app_id,
        "app_key": app_key,
        "results_per_page": limit,
    }
    what = (settings.adzuna_search_what or "").strip()
    if what:
        params["what"] = what
    url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/1"

    try:
        resp = httpx.get(url, params=params, timeout=60.0)
        resp.raise_for_status()
    except Exception as e:
        return [], repr(e)

    try:
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    for raw in results:
        if len(out) >= max_rows:
            break
        if not isinstance(raw, dict):
            continue
        c = raw_to_canonical_adzuna(raw)
        if c is not None:
            out.append(c)
    return out, None


class AdzunaAdapter:
    """Concrete adapter implementing :class:`ProviderAdapter` protocol."""

    listing_source = "adzuna"

    def fetch_canonical(self, *, max_rows: int) -> list[CanonicalJobIn]:
        jobs, err = fetch_adzuna_canonical(max_rows)
        if err:
            return []
        return jobs
