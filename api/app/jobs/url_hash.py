"""Stable URL fingerprinting for job deduplication (Phase 2)."""

from __future__ import annotations

import hashlib
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def normalize_source_url(url: str) -> str:
    raw = url.strip()
    if not raw:
        return ""
    p = urlparse(raw if "://" in raw else f"https://{raw}")
    scheme = (p.scheme or "https").lower()
    netloc = p.netloc.lower()
    if not netloc and p.path:
        # urlparse("example.com/job") puts host in path
        parts = p.path.split("/", 1)
        netloc = parts[0].lower()
        path = f"/{parts[1]}" if len(parts) > 1 else ""
    else:
        path = p.path.rstrip("/")

    query_pairs = sorted(parse_qsl(p.query, keep_blank_values=True))
    query = urlencode(query_pairs)
    return urlunparse((scheme, netloc, path, p.params, query, ""))


def hash_source_url(url: str) -> str:
    norm = normalize_source_url(url)
    return hashlib.sha256(norm.encode("utf-8")).hexdigest()
