"""Parse ``DOUBOW_JOB_BOARD_RSS_URLS`` for batched RSS ingest."""

from __future__ import annotations


def split_job_board_rss_urls(raw: str) -> list[str]:
    """Split newline-, comma-, or pipe-separated feed URLs; preserve order; dedupe."""
    if not (raw or "").strip():
        return []
    seen: set[str] = set()
    out: list[str] = []
    for line in raw.replace(",", "\n").splitlines():
        for part in line.split("|"):
            u = part.strip()
            if not u or u in seen:
                continue
            seen.add(u)
            out.append(u)
    return out
