"""
Lightweight résumé structuring from plain text (no LLM).
Feeds discovery/matching until full NLP parsing lands.
"""

from __future__ import annotations

import re

_SECTION_HINTS = (
    ("experience", re.compile(r"^\s*(experience|work history|employment)\s*:?\s*$", re.I)),
    ("education", re.compile(r"^\s*(education|academic)\s*:?\s*$", re.I)),
    ("skills", re.compile(r"^\s*(skills|technical skills|core competencies)\s*:?\s*$", re.I)),
    ("projects", re.compile(r"^\s*(projects|selected projects)\s*:?\s*$", re.I)),
    ("summary", re.compile(r"^\s*(summary|profile|objective|about)\s*:?\s*$", re.I)),
)


def structure_resume_text(text: str) -> dict[str, object]:
    """
    Split text into coarse sections using single-line headers.
    Unmatched paragraphs go under `body`.
    """
    lines = text.splitlines()
    sections: list[dict[str, str]] = []
    current_key = "body"
    current_buf: list[str] = []

    def flush() -> None:
        nonlocal current_buf
        body = "\n".join(current_buf).strip()
        if body:
            sections.append({"id": current_key, "text": body})
        current_buf = []

    for line in lines:
        matched_key: str | None = None
        for key, pattern in _SECTION_HINTS:
            if pattern.match(line):
                matched_key = key
                break
        if matched_key:
            flush()
            current_key = matched_key
            continue
        current_buf.append(line)

    flush()

    headline = ""
    if lines:
        headline = lines[0].strip()[:240]

    words = text.split()
    return {
        "headline": headline,
        "word_count": len(words),
        "sections": sections,
        "section_ids_found": list({s["id"] for s in sections}),
    }
