"""Job Opening Analyzer (RapidAPI) — résumé / pivot vs job text similarity.

POST ``/compute_similarity`` with JSON ``{"pivot": "...", "texts": ["...", ...]}``.

Subscribe on RapidAPI (search ``job-opening-analyzer``). Set ``DOUBOW_JOB_OPENING_ANALYZER_RAPIDAPI_KEY``
or reuse ``DOUBOW_RAPIDAPI_KEY`` / ``DOUBOW_JSEARCH_RAPIDAPI_KEY``.
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.settings import settings

_DEFAULT_PATH = "/compute_similarity"


def _api_key() -> str | None:
    k = (
        settings.job_opening_analyzer_rapidapi_key
        or settings.jsearch_rapidapi_key
        or settings.rapidapi_key
    )
    return k.strip() if isinstance(k, str) and k.strip() else None


def _headers() -> dict[str, str] | None:
    key = _api_key()
    if not key:
        return None
    host = (settings.job_opening_analyzer_rapidapi_host or "job-opening-analyzer.p.rapidapi.com").strip()
    return {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": host,
        "Content-Type": "application/json",
    }


def _base_url() -> str:
    host = (settings.job_opening_analyzer_rapidapi_host or "job-opening-analyzer.p.rapidapi.com").strip()
    return f"https://{host}"


def _clip(s: str, max_len: int) -> str:
    t = (s or "").strip()
    if len(t) <= max_len:
        return t
    return t[:max_len]


def post_compute_similarity(*, pivot: str, texts: list[str]) -> tuple[Any | None, str | None]:
    """POST ``/compute_similarity`` — returns parsed JSON (similarity scores; shape is upstream-defined)."""
    pivot_clean = (pivot or "").strip()
    if not pivot_clean:
        return None, "missing_pivot"
    if not texts or not any((t or "").strip() for t in texts):
        return None, "missing_texts"

    hdr = _headers()
    if not hdr:
        return None, "missing_job_opening_analyzer_credentials"

    max_pivot = max(1000, min(settings.job_opening_analyzer_max_pivot_chars, 200_000))
    max_each = max(500, min(settings.job_opening_analyzer_max_text_chars_each, 200_000))
    max_n = max(1, min(settings.job_opening_analyzer_max_texts, 100))

    clipped_texts: list[str] = []
    for raw in texts[:max_n]:
        piece = _clip(str(raw), max_each)
        if piece:
            clipped_texts.append(piece)
    if not clipped_texts:
        return None, "missing_texts"

    path = (settings.job_opening_analyzer_compute_similarity_path or _DEFAULT_PATH).strip()
    if not path.startswith("/"):
        path = f"/{path}"

    body: dict[str, Any] = {"pivot": _clip(pivot_clean, max_pivot), "texts": clipped_texts}

    try:
        resp = httpx.post(
            f"{_base_url()}{path}",
            json=body,
            headers=hdr,
            timeout=120.0,
        )
        resp.raise_for_status()
        return resp.json(), None
    except httpx.HTTPStatusError as e:
        body_err = ""
        try:
            body_err = (e.response.text or "")[:800]
        except Exception:
            pass
        return None, f"http_{e.response.status_code}:{body_err or str(e)}"
    except Exception as e:
        return None, repr(e)[:800]
