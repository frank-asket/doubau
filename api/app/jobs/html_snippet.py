"""Minimal HTML text extraction for scraper MVP (no full DOM dependency)."""

from __future__ import annotations

import re

_TITLE_RE = re.compile(r"<title[^>]*>([^<]+)</title>", re.IGNORECASE | re.DOTALL)
_H1_RE = re.compile(r"<h1[^>]*>([^<]+)</h1>", re.IGNORECASE | re.DOTALL)


def extract_title_from_html(html: str) -> str | None:
    if not html:
        return None
    m = _TITLE_RE.search(html)
    if m:
        t = re.sub(r"\s+", " ", m.group(1)).strip()
        return t or None
    m = _H1_RE.search(html)
    if m:
        t = re.sub(r"\s+", " ", m.group(1)).strip()
        return t or None
    return None
