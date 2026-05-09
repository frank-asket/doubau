"""
Shared schema hint and JSON parsing for LLM-based résumé structuring (OpenAI + Claude).
"""

from __future__ import annotations

import json
import re

RESUME_STRUCTURE_SCHEMA_HINT = (
    "{"
    '"name": string|null,'
    '"headline": string|null,'
    '"location": string|null,'
    '"emails": string[],'
    '"phones": string[],'
    '"links": string[],'
    '"summary": string|null,'
    '"skills": string[],'
    '"experience": [{"company": string|null, "title": string|null, "start": string|null, '
    '"end": string|null, "bullets": string[]}],'
    '"education": [{"school": string|null, "degree": string|null, "start": string|null, '
    '"end": string|null}]'
    "}"
)


def truncate_for_llm(text: str, max_chars: int) -> str:
    t = text.strip()
    if len(t) <= max_chars:
        return t
    return t[:max_chars]


def parse_structure_json_from_llm_text(raw: str) -> dict[str, object]:
    """Parse JSON object from model output; strips optional markdown fences."""
    t = raw.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?\s*", "", t, count=1)
        t = re.sub(r"\s*```\s*$", "", t, count=1)
        t = t.strip()
    data = json.loads(t)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object")
    return data
