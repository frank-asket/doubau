from __future__ import annotations

import json
import re
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn


class _JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._in_json_ld = False
        self._buf: list[str] = []
        self.scripts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "script":
            return
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        if attr_map.get("type", "").lower() == "application/ld+json":
            self._in_json_ld = True
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._in_json_ld:
            self._buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "script" and self._in_json_ld:
            body = "".join(self._buf).strip()
            if body:
                self.scripts.append(body)
            self._in_json_ld = False
            self._buf = []


PRESET_GREENHOUSE_BOARDS = (
    # Broad enough to smoke-test the public boards API when explicitly enabled. Product
    # relevance should still come from user résumé matching, not from this seed list.
    "airbnb",
    "doordashusa",
    "lyft",
    "reddit",
    "stripe",
)


def _clean_html(value: object, *, limit: int = 12000) -> str | None:
    if not isinstance(value, str):
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = re.sub(r"\s+", " ", unescape(text)).strip()
    return text[:limit] if text else None


def _text(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _parse_dt(value: object) -> datetime | None:
    raw = _text(value)
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _first_text(value: object) -> str | None:
    if isinstance(value, list):
        for item in value:
            out = _first_text(item)
            if out:
                return out
        return None
    if isinstance(value, dict):
        for key in ("name", "addressLocality", "addressRegion", "addressCountry", "@id"):
            out = _first_text(value.get(key))
            if out:
                return out
        for item in value.values():
            out = _first_text(item)
            if out:
                return out
        return None
    return _text(value)


def _jobposting_nodes(value: object) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if isinstance(value, list):
        for item in value:
            out.extend(_jobposting_nodes(item))
        return out
    if not isinstance(value, dict):
        return out

    typ = value.get("@type")
    types = typ if isinstance(typ, list) else [typ]
    if any(str(t).lower() == "jobposting" for t in types):
        out.append(value)

    graph = value.get("@graph")
    if graph is not None:
        out.extend(_jobposting_nodes(graph))
    return out


def _jsonld_to_canonical(
    node: dict[str, Any],
    *,
    fallback_url: str | None,
) -> CanonicalJobIn | None:
    title = _text(node.get("title"))
    if not title:
        return None

    org = node.get("hiringOrganization")
    company = _first_text(org) or _text(node.get("company")) or "Unknown company"

    url = (
        _first_text(node.get("url"))
        or _first_text(node.get("sameAs"))
        or _first_text(node.get("mainEntityOfPage"))
        or fallback_url
    )
    if not url:
        return None

    location = _first_text(node.get("jobLocation")) or _first_text(
        node.get("applicantLocationRequirements")
    )
    employment = _first_text(node.get("employmentType"))
    identifier = _first_text(node.get("identifier"))

    return CanonicalJobIn(
        title=title[:220],
        company=company[:200],
        location=(location[:220] if location else None),
        description=_clean_html(node.get("description")),
        apply_url=url[:1000],
        listing_source="scrapling_jsonld",
        employment_type=(employment[:80] if employment else None),
        seniority=None,
        tags=[],
        external_ref=(identifier[:200] if identifier else None),
        source_posted_at=_parse_dt(node.get("datePosted")),
    )


def extract_jsonld_jobs(html: str, *, page_url: str | None = None) -> list[CanonicalJobIn]:
    parser = _JsonLdParser()
    parser.feed(html)
    jobs: list[CanonicalJobIn] = []
    for script in parser.scripts:
        try:
            data = json.loads(script)
        except json.JSONDecodeError:
            continue
        for node in _jobposting_nodes(data):
            job = _jsonld_to_canonical(node, fallback_url=page_url)
            if job is not None:
                jobs.append(job)
    return jobs


def _greenhouse_board_from_url(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    parts = [p for p in parsed.path.split("/") if p]

    if host == "boards-api.greenhouse.io":
        if len(parts) >= 3 and parts[:2] == ["v1", "boards"]:
            return parts[2]
        return None

    if host in {"job-boards.greenhouse.io", "boards.greenhouse.io"}:
        return parts[0] if parts else None

    return None


def _greenhouse_company_name(board: str) -> str:
    return re.sub(r"[-_]+", " ", board).strip().title() or "Greenhouse company"


def _greenhouse_job_to_canonical(raw: dict[str, Any], *, board: str) -> CanonicalJobIn | None:
    title = _text(raw.get("title"))
    url = _text(raw.get("absolute_url")) or _text(raw.get("url"))
    if not title or not url:
        return None

    loc_block = raw.get("location")
    location = _first_text(loc_block)
    jid = raw.get("id")

    departments = raw.get("departments")
    tags: list[str] = []
    if isinstance(departments, list):
        for dep in departments[:8]:
            name = _first_text(dep)
            if name:
                tags.append(name[:80])

    return CanonicalJobIn(
        title=title[:220],
        company=_greenhouse_company_name(board)[:200],
        location=(location[:220] if location else None),
        description=_clean_html(raw.get("content")),
        apply_url=url[:1000],
        listing_source="greenhouse",
        employment_type=None,
        seniority=None,
        tags=tags,
        external_ref=(str(jid)[:200] if jid is not None else None),
        source_posted_at=_parse_dt(raw.get("updated_at")),
    )


def fetch_greenhouse_board_canonical(
    board: str,
    *,
    max_jobs: int,
    timeout_s: float,
) -> tuple[list[CanonicalJobIn], str | None]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"
    try:
        resp = httpx.get(url, params={"content": "true"}, timeout=timeout_s)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    rows = data.get("jobs") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    for raw in rows:
        if len(out) >= max_jobs:
            break
        if not isinstance(raw, dict):
            continue
        job = _greenhouse_job_to_canonical(raw, board=board)
        if job is not None:
            out.append(job)
    return out, None


def _lever_site_from_url(url: str) -> str | None:
    parsed = urlparse(url.strip())
    host = parsed.netloc.lower()
    parts = [p for p in parsed.path.split("/") if p]
    if host in {"api.lever.co", "api.eu.lever.co"} and len(parts) >= 3 and parts[:2] == ["v0", "postings"]:
        return parts[2]
    if host == "jobs.lever.co" and parts:
        return parts[0]
    return None


def _lever_api_origin_for_url(url: str) -> str:
    host = urlparse(url.strip()).netloc.lower()
    if host == "api.eu.lever.co":
        return "https://api.eu.lever.co"
    return "https://api.lever.co"


def _lever_job_to_canonical(raw: dict[str, Any], *, site: str) -> CanonicalJobIn | None:
    title = _text(raw.get("text"))
    url = _text(raw.get("hostedUrl")) or _text(raw.get("applyUrl"))
    if not title or not url:
        return None
    cats = raw.get("categories")
    location = None
    if isinstance(cats, dict):
        location = _text(cats.get("location")) or _first_text(cats.get("allLocations"))
    tags: list[str] = []
    if isinstance(cats, dict):
        for key in ("team", "department", "commitment"):
            t = _text(cats.get(key))
            if t:
                tags.append(t[:80])
    jid = raw.get("id")
    return CanonicalJobIn(
        title=title[:220],
        company=_greenhouse_company_name(site)[:200],
        location=(location[:220] if location else None),
        description=_clean_html(raw.get("description")) or _text(raw.get("descriptionPlain")),
        apply_url=url[:1000],
        listing_source="lever",
        employment_type=_text(raw.get("workplaceType"))[:80] if _text(raw.get("workplaceType")) else None,
        seniority=None,
        tags=tags,
        external_ref=(str(jid)[:200] if jid is not None else None),
        source_posted_at=None,
    )


def fetch_lever_postings_canonical(
    site: str,
    *,
    api_origin: str,
    max_jobs: int,
    timeout_s: float,
) -> tuple[list[CanonicalJobIn], str | None]:
    """Public Lever postings list (``GET /v0/postings/{site}?mode=json``)."""
    site = site.strip().strip("/")
    if not site:
        return [], "empty_lever_site"
    url = f"{api_origin.rstrip('/')}/v0/postings/{site}"
    try:
        resp = httpx.get(
            url,
            params={"mode": "json", "limit": max(1, min(int(max_jobs), 100))},
            timeout=timeout_s,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    if not isinstance(data, list):
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    for raw in data:
        if len(out) >= max_jobs:
            break
        if not isinstance(raw, dict):
            continue
        job = _lever_job_to_canonical(raw, site=site)
        if job is not None:
            out.append(job)
    return out, None


def _ashby_job_board_api_url(url: str) -> str | None:
    raw = (url or "").strip()
    if not raw:
        return None
    p = urlparse(raw.split("#", 1)[0])
    if p.scheme not in {"http", "https"} or p.netloc.lower() != "api.ashbyhq.com":
        return None
    parts = [seg for seg in p.path.split("/") if seg]
    if len(parts) >= 3 and parts[0] == "posting-api" and parts[1] == "job-board":
        return p._replace(fragment="").geturl()
    return None


def _ashby_board_slug_from_api_url(url: str) -> str:
    p = urlparse(url)
    parts = [seg for seg in p.path.split("/") if seg]
    if len(parts) >= 3 and parts[0] == "posting-api" and parts[1] == "job-board":
        return parts[2]
    return "ashby"


def _ashby_job_to_canonical(raw: dict[str, Any], *, board_slug: str) -> CanonicalJobIn | None:
    title = _text(raw.get("title"))
    url = _text(raw.get("applyUrl")) or _text(raw.get("jobUrl"))
    if not title or not url:
        return None
    location = _text(raw.get("location"))
    tags: list[str] = []
    for key in ("department", "team"):
        t = _text(raw.get(key))
        if t:
            tags.append(t[:80])
    desc = _clean_html(raw.get("descriptionHtml")) or _text(raw.get("descriptionPlain"))
    et = _text(raw.get("employmentType"))
    jid = raw.get("id")
    return CanonicalJobIn(
        title=title[:220],
        company=_greenhouse_company_name(board_slug)[:200],
        location=(location[:220] if location else None),
        description=desc,
        apply_url=url[:1000],
        listing_source="ashby",
        employment_type=(et[:80] if et else None),
        seniority=None,
        tags=tags,
        external_ref=(str(jid)[:200] if jid is not None else None),
        source_posted_at=_parse_dt(raw.get("publishedAt")),
    )


def fetch_ashby_job_board_canonical(
    api_url: str,
    *,
    max_jobs: int,
    timeout_s: float,
) -> tuple[list[CanonicalJobIn], str | None]:
    """Public Ashby job-board API (``/posting-api/job-board/{company}``)."""
    board_slug = _ashby_board_slug_from_api_url(api_url)
    fetch_url = api_url.strip()
    if "includeCompensation=" not in fetch_url:
        fetch_url = fetch_url + ("&" if "?" in fetch_url else "?") + "includeCompensation=false"
    try:
        resp = httpx.get(
            fetch_url,
            timeout=timeout_s,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    rows = data.get("jobs") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    for raw in rows:
        if len(out) >= max_jobs:
            break
        if not isinstance(raw, dict):
            continue
        job = _ashby_job_to_canonical(raw, board_slug=board_slug)
        if job is not None:
            out.append(job)
    return out, None


def _workday_cxs_jobs_endpoint(url: str) -> str | None:
    raw = (url or "").strip().split("#", 1)[0].strip()
    if not raw:
        return None
    p = urlparse(raw)
    if p.scheme not in {"http", "https"} or not p.netloc.lower().endswith(".myworkdayjobs.com"):
        return None
    parts = [seg for seg in p.path.split("/") if seg]
    if len(parts) < 5 or parts[-1] != "jobs":
        return None
    if parts[0] != "wday" or parts[1] != "cxs":
        return None
    return p._replace(fragment="", query="").geturl()


def _workday_cxs_context(url: str) -> dict[str, str] | None:
    ep = _workday_cxs_jobs_endpoint(url)
    if not ep:
        return None
    p = urlparse(ep)
    parts = [seg for seg in p.path.split("/") if seg]
    org, site = parts[2], parts[3]
    return {"origin": f"{p.scheme}://{p.netloc}", "org": org, "site": site, "jobs_endpoint": ep, "locale": "en-US"}


def _workday_job_to_canonical(
    raw: dict[str, Any],
    *,
    origin: str,
    org_slug: str,
    career_site: str,
    locale: str,
) -> CanonicalJobIn | None:
    title = _text(raw.get("title"))
    ext = _text(raw.get("externalPath"))
    if not title or not ext:
        return None
    ext = ext if ext.startswith("/") else f"/{ext}"
    apply_url = f"{origin.rstrip('/')}/{locale.strip('/')}/{career_site.strip('/')}{ext}"[:1000]
    loc = _text(raw.get("locationsText"))
    bullet = raw.get("bulletFields")
    ref = None
    if isinstance(bullet, list) and bullet:
        ref = _text(bullet[0])
    company = _greenhouse_company_name(org_slug)[:200]
    return CanonicalJobIn(
        title=title[:220],
        company=company,
        location=(loc[:220] if loc else None),
        description=None,
        apply_url=apply_url,
        listing_source="workday_cxs",
        employment_type=None,
        seniority=None,
        tags=[],
        external_ref=(ref[:200] if ref else None),
        source_posted_at=None,
    )


def fetch_workday_cxs_canonical(
    cxs_jobs_url: str,
    *,
    max_jobs: int,
    timeout_s: float,
) -> tuple[list[CanonicalJobIn], str | None]:
    """Workday CXS job search (POST ``.../wday/cxs/{org}/{CareerSite}/jobs``)."""
    ctx = _workday_cxs_context(cxs_jobs_url)
    if not ctx:
        return [], "invalid_workday_cxs_url"

    body = {
        "appliedFacets": {},
        "limit": max(1, min(int(max_jobs), 50)),
        "offset": 0,
        "searchText": "",
    }
    try:
        resp = httpx.post(
            ctx["jobs_endpoint"],
            json=body,
            timeout=timeout_s,
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return [], repr(e)

    rows = data.get("jobPostings") if isinstance(data, dict) else None
    if not isinstance(rows, list):
        return [], "unexpected_shape"

    out: list[CanonicalJobIn] = []
    for raw in rows:
        if len(out) >= max_jobs:
            break
        if not isinstance(raw, dict):
            continue
        job = _workday_job_to_canonical(
            raw,
            origin=ctx["origin"],
            org_slug=ctx["org"],
            career_site=ctx["site"],
            locale=ctx["locale"],
        )
        if job is not None:
            out.append(job)
    return out, None


def _load_fixture_jobs(path: str) -> tuple[list[CanonicalJobIn], str | None]:
    if not path.strip():
        return [], None
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception as e:
        return [], repr(e)

    rows: object = data
    if isinstance(data, dict):
        for key in ("jobs", "listings", "items"):
            if isinstance(data.get(key), list):
                rows = data[key]
                break

    jobs: list[CanonicalJobIn] = []
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        try:
            jobs.append(CanonicalJobIn.model_validate(row))
            continue
        except Exception:
            pass
        job = _jsonld_to_canonical(row, fallback_url=None)
        if job is not None:
            jobs.append(job)
    return jobs, None


def _seed_urls() -> list[str]:
    raw = settings.scrapling_seed_urls.strip()
    if not raw:
        return []
    return [u.strip() for u in re.split(r"[\n,]+", raw) if u.strip()]


def fetch_scrapling_canonical(max_rows: int) -> tuple[list[CanonicalJobIn], str | None]:
    if not settings.scrapling_enabled:
        return [], "scrapling_disabled"

    timeout_s = max(1.0, float(settings.scrapling_timeout_s))
    per_board = max(1, settings.scrapling_greenhouse_seed_jobs_per_board)
    jobs: list[CanonicalJobIn] = []
    errors: list[str] = []

    fixture_jobs, fixture_err = _load_fixture_jobs(settings.scrapling_fixture_json_path)
    if fixture_err:
        errors.append(f"fixture:{fixture_err}")
    jobs.extend(fixture_jobs)

    boards: list[str] = []
    lever_entries: list[tuple[str, str]] = []
    ashby_urls: list[str] = []
    workday_urls: list[str] = []
    page_urls: list[str] = []
    for url in _seed_urls():
        board = _greenhouse_board_from_url(url)
        if board:
            boards.append(board)
            continue
        lev = _lever_site_from_url(url)
        if lev:
            lever_entries.append((_lever_api_origin_for_url(url), lev))
            continue
        au = _ashby_job_board_api_url(url)
        if au:
            ashby_urls.append(au)
            continue
        wx = _workday_cxs_jobs_endpoint(url)
        if wx:
            workday_urls.append(wx)
            continue
        page_urls.append(url)

    if settings.scrapling_auto_greenhouse_board_seeds and settings.scrapling_catalog_in_preset:
        boards.extend(PRESET_GREENHOUSE_BOARDS)

    seen_boards: set[str] = set()
    for board in boards:
        if len(jobs) >= max_rows:
            break
        if board in seen_boards:
            continue
        seen_boards.add(board)
        rows, err = fetch_greenhouse_board_canonical(
            board,
            max_jobs=min(per_board, max_rows - len(jobs)),
            timeout_s=timeout_s,
        )
        if err:
            errors.append(f"greenhouse:{board}:{err}")
        jobs.extend(rows)

    seen_lever: set[tuple[str, str]] = set()
    for origin, site in lever_entries:
        if len(jobs) >= max_rows:
            break
        key = (origin, site.lower())
        if key in seen_lever:
            continue
        seen_lever.add(key)
        rows, err = fetch_lever_postings_canonical(
            site,
            api_origin=origin,
            max_jobs=min(per_board, max_rows - len(jobs)),
            timeout_s=timeout_s,
        )
        if err:
            errors.append(f"lever:{site}:{err}")
        jobs.extend(rows)

    seen_ashby: set[str] = set()
    for au in ashby_urls:
        if len(jobs) >= max_rows:
            break
        if au in seen_ashby:
            continue
        seen_ashby.add(au)
        rows, err = fetch_ashby_job_board_canonical(
            au,
            max_jobs=min(per_board, max_rows - len(jobs)),
            timeout_s=timeout_s,
        )
        if err:
            errors.append(f"ashby:{au}:{err}")
        jobs.extend(rows)

    seen_wd: set[str] = set()
    for wx in workday_urls:
        if len(jobs) >= max_rows:
            break
        if wx in seen_wd:
            continue
        seen_wd.add(wx)
        rows, err = fetch_workday_cxs_canonical(
            wx,
            max_jobs=min(per_board, max_rows - len(jobs)),
            timeout_s=timeout_s,
        )
        if err:
            errors.append(f"workday:{wx}:{err}")
        jobs.extend(rows)

    for url in page_urls:
        if len(jobs) >= max_rows:
            break
        try:
            resp = httpx.get(url, timeout=timeout_s, follow_redirects=True)
            resp.raise_for_status()
            jobs.extend(extract_jsonld_jobs(resp.text, page_url=str(resp.url)))
        except Exception as e:
            errors.append(f"url:{url}:{e!r}")

    if jobs:
        return jobs[:max_rows], None
    if errors:
        return [], "; ".join(errors[:3])
    return [], None
