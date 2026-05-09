from __future__ import annotations

import hashlib


def content_fingerprint_sha256(*, title: str, company: str, location: str | None) -> str:
    """
    Stable fingerprint for cross-URL duplicate listings (same role, different apply URLs).

    Normalizes casing and whitespace; hashes title|company|location.
    """
    parts = [
        (title or "").lower().strip(),
        (company or "").lower().strip(),
        (location or "").lower().strip(),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
