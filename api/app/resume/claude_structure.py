"""
Optional résumé structuring with Anthropic Claude (Messages API).

Best-effort: failures raise ResumeLLMStructureError (matching never blocks).
"""

from __future__ import annotations

import json

import httpx

from app.core.settings import settings
from app.resume.llm_structure import ResumeLLMStructureError
from app.resume.structure_schema import (
    RESUME_STRUCTURE_SCHEMA_HINT,
    parse_structure_json_from_llm_text,
    truncate_for_llm,
)

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"


def claude_structure_resume_text(text: str) -> dict[str, object]:
    """
    Return a normalized JSON object with core résumé fields.

    Requires ``DOUBOW_ANTHROPIC_API_KEY`` (no separate enable flag — orchestration is in tasks).
    """
    if not settings.anthropic_api_key:
        raise ResumeLLMStructureError("DOUBOW_ANTHROPIC_API_KEY is not set")

    trimmed = truncate_for_llm(text, max(1, settings.resume_llm_structuring_max_chars))
    if not trimmed:
        raise ResumeLLMStructureError("No text to structure")

    sys_msg = (
        "Extract structured résumé data. Respond ONLY with a single JSON object "
        f"matching this schema (extra keys allowed, but keep it small): "
        f"{RESUME_STRUCTURE_SCHEMA_HINT}. "
        "No markdown fences, no prose outside JSON."
    )

    payload = {
        "model": settings.anthropic_chat_model,
        "max_tokens": 8192,
        "temperature": 0.0,
        "system": sys_msg,
        "messages": [{"role": "user", "content": trimmed}],
    }
    headers = {
        "x-api-key": settings.anthropic_api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    try:
        with httpx.Client(timeout=120.0) as client:
            resp = client.post(ANTHROPIC_MESSAGES_URL, json=payload, headers=headers)
    except Exception as e:  # noqa: BLE001
        raise ResumeLLMStructureError(str(e)) from e

    if resp.status_code >= 400:
        raise ResumeLLMStructureError(f"Anthropic HTTP {resp.status_code}: {resp.text[:500]}")

    try:
        body = resp.json()
    except Exception as e:  # noqa: BLE001
        raise ResumeLLMStructureError(f"Invalid Anthropic response JSON: {e}") from e

    parts: list[str] = []
    for block in body.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            parts.append(str(block.get("text") or ""))
    raw = "".join(parts).strip()
    if not raw:
        raise ResumeLLMStructureError("Empty model response")

    try:
        return parse_structure_json_from_llm_text(raw)
    except (json.JSONDecodeError, ValueError) as e:
        raise ResumeLLMStructureError(f"Invalid JSON: {e}") from e
