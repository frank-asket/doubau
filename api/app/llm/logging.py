"""Persist LLM agent calls for Phase 3 observability (`llm_logs` table)."""

from __future__ import annotations

import hashlib
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.llm_log import LlmLog


def prompt_sha256(*parts: str) -> str:
    """Stable hash for dedup / indexing (64-char hex)."""
    joined = "\n".join(parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def record_llm_interaction(
    db: Session,
    *,
    user_id: UUID,
    agent_name: str,
    prompt_parts: tuple[str, ...],
    raw_output: str,
    latency_ms: int | None = None,
    user_edit: str | None = None,
    feedback_score: int | None = None,
) -> LlmLog:
    row = LlmLog(
        user_id=user_id,
        agent_name=agent_name,
        prompt_hash=prompt_sha256(*prompt_parts),
        raw_output=raw_output,
        latency_ms=latency_ms,
        user_edit=user_edit,
        feedback_score=feedback_score,
    )
    db.add(row)
    return row
