"""
Optional résumé structuring with an LLM.

This is deliberately best-effort: failures should never block embeddings or matching.
"""

from __future__ import annotations

import json

from openai import OpenAI

from app.core.settings import settings
from app.resume.structure_schema import (
    RESUME_STRUCTURE_SCHEMA_HINT,
    parse_structure_json_from_llm_text,
    truncate_for_llm,
)


class ResumeLLMStructureError(Exception):
    """Raised when the LLM response is missing/invalid JSON."""


def openai_structure_resume_text(text: str) -> dict[str, object]:
    """
    Structure résumé text using OpenAI chat JSON mode.

    Caller must ensure ``DOUBOW_OPENAI_API_KEY`` is set (no global enabled flag).
    """
    if not settings.openai_api_key:
        raise ResumeLLMStructureError("DOUBOW_OPENAI_API_KEY is not set")

    trimmed = truncate_for_llm(text, max(1, settings.resume_llm_structuring_max_chars))
    if not trimmed:
        raise ResumeLLMStructureError("No text to structure")

    sys_msg = (
        "Extract structured résumé data. Respond ONLY with a single JSON object "
        f"matching this schema (extra keys allowed, but keep it small): "
        f"{RESUME_STRUCTURE_SCHEMA_HINT}. "
        "No markdown, no prose outside JSON."
    )

    client = OpenAI(api_key=settings.openai_api_key)
    try:
        resp = client.chat.completions.create(
            model=settings.openai_chat_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": trimmed},
            ],
            temperature=0.0,
        )
    except Exception as e:  # noqa: BLE001
        raise ResumeLLMStructureError(str(e)) from e

    raw = resp.choices[0].message.content
    if not raw:
        raise ResumeLLMStructureError("Empty model response")

    try:
        data = parse_structure_json_from_llm_text(raw)
    except json.JSONDecodeError as e:
        raise ResumeLLMStructureError(f"Invalid JSON: {e}") from e
    except ValueError as e:
        raise ResumeLLMStructureError(str(e)) from e

    return data


def llm_structure_resume_text(text: str) -> dict[str, object]:
    """
    Return a normalized JSON object with core résumé fields.

    Requires ``DOUBOW_RESUME_LLM_STRUCTURING_ENABLED=true`` and ``DOUBOW_OPENAI_API_KEY``.
    """
    if not settings.resume_llm_structuring_enabled:
        raise ResumeLLMStructureError("LLM structuring disabled")
    return openai_structure_resume_text(text)
