"""Normalize JSearch RapidAPI ``/job-details`` payloads for the job detail UI."""

from __future__ import annotations

import re
from typing import Any


def jsearch_job_details_flat(envelope: dict[str, Any] | None) -> dict[str, Any]:
    """Extract the inner job object from a JSearch JSON envelope ``{status, data, ...}``."""
    if not envelope or not isinstance(envelope, dict):
        return {}
    data = envelope.get("data")
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return data[0]
    return {}


def _clip_str(val: Any, max_len: int) -> str | None:
    if not isinstance(val, str):
        return None
    s = val.strip()
    if not s:
        return None
    return s[:max_len]


def _first_logo_url(flat: dict[str, Any]) -> str | None:
    for key in ("employer_logo", "employer_logo_url", "employer_logo_url_direct"):
        u = _clip_str(flat.get(key), 2000)
        if u and u.startswith(("http://", "https://")):
            return u
    return None


def _first_http_url(flat: dict[str, Any], *keys: str) -> str | None:
    for key in keys:
        u = _clip_str(flat.get(key), 2000)
        if u and u.startswith(("http://", "https://")):
            return u
    return None


def _coerce_skill_list(val: Any) -> list[str]:
    if val is None:
        return []
    if isinstance(val, str):
        parts = [p.strip() for p in re.split(r"[,;|\n]", val) if p.strip()]
        return [p[:160] for p in parts[:50]]
    if isinstance(val, list):
        out: list[str] = []
        for x in val:
            if isinstance(x, str) and x.strip():
                out.append(x.strip()[:160])
            elif isinstance(x, dict):
                for k in ("name", "skill", "title", "label", "value"):
                    s = x.get(k)
                    if isinstance(s, str) and s.strip():
                        out.append(s.strip()[:160])
                        break
        return out[:50]
    return []


def _coerce_text_bullets(val: Any) -> list[str]:
    """Strings or list of strings / dicts → short lines for UI."""
    if val is None:
        return []
    if isinstance(val, str) and val.strip():
        return [val.strip()[:800]]
    if not isinstance(val, list):
        return []
    out: list[str] = []
    for item in val[:40]:
        if isinstance(item, str) and item.strip():
            out.append(item.strip()[:800])
            continue
        if not isinstance(item, dict):
            continue
        parts: list[str] = []
        for k in ("title", "headline", "highlight", "name"):
            s = item.get(k)
            if isinstance(s, str) and s.strip():
                parts.append(s.strip()[:240])
        for k in ("text", "description", "body", "value"):
            s = item.get(k)
            if isinstance(s, str) and s.strip():
                parts.append(s.strip()[:600])
                break
        if parts:
            out.append(" — ".join(parts)[:1200])
    return out


def _coerce_qna(val: Any) -> list[dict[str, str]]:
    if not isinstance(val, list):
        return []
    rows: list[dict[str, str]] = []
    for item in val[:25]:
        if not isinstance(item, dict):
            continue
        q = item.get("question") or item.get("q") or item.get("title")
        a = item.get("answer") or item.get("a") or item.get("text") or item.get("body")
        qs = _clip_str(q, 400) or ""
        ans = _clip_str(a, 2000) or ""
        if qs or ans:
            rows.append({"question": qs, "answer": ans})
    return rows


def jsearch_flat_to_enrichment_dict(flat: dict[str, Any]) -> dict[str, Any]:
    """Map JSearch ``/job-details`` data object → stable fields for ``JobRapidapiEnrichmentOut``."""
    linkedin = _first_http_url(flat, "employer_linkedin", "employer_linkedin_url", "employer_linkedin_profile")
    if linkedin is None:
        raw_li = _clip_str(flat.get("employer_linkedin"), 400)
        if raw_li and "linkedin.com" in raw_li.lower():
            linkedin = raw_li if raw_li.startswith("http") else f"https://{raw_li.lstrip('/')}"

    website = _first_http_url(flat, "employer_website", "employer_website_url")
    apply_link = _first_http_url(flat, "job_apply_link", "apply_link")

    highlights = _coerce_text_bullets(flat.get("job_highlights"))
    if not highlights:
        highlights = _coerce_text_bullets(flat.get("highlights"))

    benefits = _coerce_text_bullets(flat.get("job_benefits"))
    if not benefits:
        benefits = _coerce_text_bullets(flat.get("benefits"))

    skills = _coerce_skill_list(flat.get("job_required_skills"))
    if not skills:
        skills = _coerce_skill_list(flat.get("required_skills"))

    qna = _coerce_qna(flat.get("job_qna"))
    if not qna:
        qna = _coerce_qna(flat.get("qna"))

    publisher = _clip_str(flat.get("job_publisher"), 120)

    company_type = _clip_str(flat.get("employer_company_type"), 120)

    return {
        "employer_logo_url": _first_logo_url(flat),
        "employer_website": website,
        "employer_linkedin_url": linkedin,
        "employer_company_type": company_type,
        "apply_link": apply_link,
        "required_skills": skills,
        "highlights": highlights,
        "benefits": benefits,
        "publisher": publisher,
        "qna": qna,
    }
