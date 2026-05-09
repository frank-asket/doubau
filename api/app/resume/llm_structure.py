"""
Optional résumé structuring with an LLM.

This is deliberately best-effort: failures should never block embeddings or matching.
"""

from __future__ import annotations

import json

from openai import OpenAI

from app.core.settings import settings


class ResumeLLMStructureError(Exception):
    """Raised when the LLM response is missing/invalid JSON."""


def _truncate_for_llm(text: str, max_chars: int) -> str:
    t = text.strip()
    if len(t) <= max_chars:
        return t
    return t[:max_chars]


def llm_structure_resume_text(text: str) -> dict[str, object]:
    """
    Return a normalized JSON object with core résumé fields.

    Requires `DOUBOW_OPENAI_API_KEY` and `DOUBOW_RESUME_LLM_STRUCTURING_ENABLED=true`.
    """
    if not settings.resume_llm_structuring_enabled:
        raise ResumeLLMStructureError("LLM structuring disabled")
    if not settings.openai_api_key:
        raise ResumeLLMStructureError("DOUBOW_OPENAI_API_KEY is not set")

    trimmed = _truncate_for_llm(text, max(1, settings.resume_llm_structuring_max_chars))
    if not trimmed:
        raise ResumeLLMStructureError("No text to structure")

    schema_hint = (
        '{'
        '"name": string|null,'
        '"headline": string|null,'
        '"location": string|null,'
        '"emails": string[],'
        '"phones": string[],'
        '"links": string[],'
        '"summary": string|null,'
        '"skills": string[],'
        '"experience": [{"company": string|null, "title": string|null, "start": string|null, "end": string|null, "bullets": string[]}],'
        '"education": [{"school": string|null, "degree": string|null, "start": string|null, "end": string|null}]'
        '}'
    )
    sys_msg = (
        "Extract structured résumé data. Respond ONLY with a single JSON object "
        f"matching this schema (extra keys allowed, but keep it small): {schema_hint}. "
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
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ResumeLLMStructureError(f"Invalid JSON: {e}") from e

    if not isinstance(data, dict):
        raise ResumeLLMStructureError("Expected a JSON object")
    return data

