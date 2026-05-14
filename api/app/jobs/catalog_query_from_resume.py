"""Derive catalog ingest search strings from profile + résumé (JSearch / SerpAPI / similar APIs)."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.outreach import latest_resume_excerpt_for_user
from app.models.profile import Profile
from app.models.resume_document import ResumeDocument, ResumeStatus


def _unwrap_structured(parsed: dict[str, Any] | None) -> dict[str, Any] | None:
    if not parsed or not isinstance(parsed, dict):
        return None
    inner = parsed.get("structured_llm")
    if isinstance(inner, dict):
        return inner
    return parsed


def build_catalog_job_search_query(
    *,
    goals: dict[str, Any] | None,
    parsed_json: dict[str, Any] | None,
    extracted_excerpt: str | None,
    max_len: int = 400,
) -> str:
    """
    Build a short plain-text query for job-search APIs.

    Priority: explicit ``goals.job_search_query`` (or legacy keys) → ``goals.focus`` list
    → structured ``headline`` + ``skills`` → first line of résumé excerpt → empty string.
    """
    g = goals if isinstance(goals, dict) else None
    if g:
        for key in ("job_search_query", "catalog_ingest_query", "focus_query"):
            v = g.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()[:max_len]
        focus = g.get("focus")
        if isinstance(focus, list) and focus:
            parts = [str(x).strip() for x in focus if isinstance(x, str) and str(x).strip()][:8]
            if parts:
                return " ".join(parts)[:max_len]

    root = _unwrap_structured(parsed_json)
    if root:
        parts: list[str] = []
        hl = root.get("headline")
        if isinstance(hl, str) and hl.strip():
            parts.append(hl.strip()[:160])
        skills = root.get("skills")
        if isinstance(skills, list):
            for s in skills[:12]:
                if isinstance(s, str) and s.strip():
                    parts.append(s.strip()[:60])
        if parts:
            return " ".join(parts)[:max_len]

    if extracted_excerpt and extracted_excerpt.strip():
        one = " ".join(extracted_excerpt.split())
        one = re.sub(r"[\x00-\x1f\x7f]", " ", one).strip()
        return one[:max_len] if one else ""

    return ""


def catalog_query_for_user(db: Session, user_id: UUID) -> str:
    """Aggregate profile goals + latest résumé excerpt / parsed JSON into one search string."""
    prof = db.scalar(select(Profile).where(Profile.user_id == user_id))
    goals = prof.goals if prof and isinstance(prof.goals, dict) else None

    row = db.execute(
        select(ResumeDocument)
        .where(ResumeDocument.user_id == user_id)
        .where(
            ResumeDocument.status.in_(
                (ResumeStatus.EMBEDDED, ResumeStatus.PARSED, ResumeStatus.UPLOADED)
            )
        )
        .order_by(ResumeDocument.updated_at.desc())
        .limit(1)
    ).scalar_one_or_none()

    pj = row.parsed_json if row is not None and isinstance(row.parsed_json, dict) else None
    excerpt = latest_resume_excerpt_for_user(db, user_id, max_chars=3500)
    return build_catalog_job_search_query(
        goals=goals,
        parsed_json=pj,
        extracted_excerpt=excerpt,
    )
