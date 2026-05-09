"""
Optional résumé structuring via OpenRouter (OpenAI-compatible API).

Use any OpenRouter model id (e.g. ``anthropic/claude-3.5-haiku``) with one API key.
"""

from __future__ import annotations

import json

from openai import OpenAI

from app.core.settings import settings
from app.resume.llm_structure import ResumeLLMStructureError
from app.resume.structure_schema import (
    RESUME_STRUCTURE_SCHEMA_HINT,
    parse_structure_json_from_llm_text,
    truncate_for_llm,
)


def openrouter_structure_resume_text(text: str) -> dict[str, object]:
    """
    Structure résumé text using OpenRouter ``/v1/chat/completions``.

    Requires ``DOUBOW_OPENROUTER_API_KEY``. Model defaults to a Claude Haiku slug on OpenRouter.
    """
    if not settings.openrouter_api_key:
        raise ResumeLLMStructureError("DOUBOW_OPENROUTER_API_KEY is not set")

    trimmed = truncate_for_llm(text, max(1, settings.resume_llm_structuring_max_chars))
    if not trimmed:
        raise ResumeLLMStructureError("No text to structure")

    sys_msg = (
        "Extract structured résumé data. Respond ONLY with a single JSON object "
        f"matching this schema (extra keys allowed, but keep it small): "
        f"{RESUME_STRUCTURE_SCHEMA_HINT}. "
        "No markdown fences, no prose outside JSON."
    )

    headers: dict[str, str] = {}
    if settings.openrouter_http_referer:
        headers["HTTP-Referer"] = settings.openrouter_http_referer
    if settings.openrouter_app_title:
        headers["X-Title"] = settings.openrouter_app_title

    client_kw: dict[str, object] = {
        "api_key": settings.openrouter_api_key,
        "base_url": settings.openrouter_base_url.rstrip("/"),
    }
    if headers:
        client_kw["default_headers"] = headers

    client = OpenAI(**client_kw)

    kwargs = {
        "model": settings.openrouter_chat_model,
        "messages": [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": trimmed},
        ],
        "temperature": 0.0,
    }

    try:
        resp = client.chat.completions.create(
            **kwargs,
            response_format={"type": "json_object"},
        )
    except Exception as first_err:  # noqa: BLE001
        try:
            resp = client.chat.completions.create(**kwargs)
        except Exception as second_err:  # noqa: BLE001
            raise ResumeLLMStructureError(f"{first_err}; retry: {second_err}") from second_err

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
