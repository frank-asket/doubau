from __future__ import annotations

import hashlib


def content_fingerprint_sha256(*, title: str, company: str, location: str | None) -> str:
    """
    Stable fingerprint for duplicate listings with the same title/company/location.

    Used with a per-``listing_source`` Redis key in ``persist_canonical_job`` so different
    providers can each store a row; duplicates within one provider still dedupe.
    """
    parts = [
        (title or "").lower().strip(),
        (company or "").lower().strip(),
        (location or "").lower().strip(),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
