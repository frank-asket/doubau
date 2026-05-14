"""
RAG-style context for interview prep: retrieve résumé snippets most similar to the role query.

Uses OpenAI embeddings with batched inputs (query + overlapping résumé chunks). Falls back to a
single excerpt when embeddings are unavailable.
"""

from __future__ import annotations

import math
import re
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from app.models.job import Job

from openai import OpenAI
from sqlalchemy.orm import Session

from app.core.settings import settings
from app.resume.embeddings import truncate_for_embedding


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _chunk_text(text: str, *, size: int = 900, overlap: int = 120) -> list[str]:
    t = text.strip()
    if not t:
        return []
    chunks: list[str] = []
    i = 0
    while i < len(t):
        chunk = t[i : i + size]
        chunks.append(chunk.strip())
        i += max(size - overlap, 1)
    return [c for c in chunks if c]


def retrieve_resume_context_for_role(
    *,
    resume_text: str | None,
    company: str,
    job_title: str,
    job_description_excerpt: str | None,
    max_chunks: int = 5,
    max_embedding_chunks: int = 24,
) -> tuple[str | None, dict[str, Any]]:
    """
    Returns (assembled_context, meta) where context is plain text for the LLM prompt.

    When OpenAI is configured and resume_text is present, selects top chunks by cosine similarity
    to an embedding of the role query.
    """
    meta: dict[str, Any] = {"mode": "none", "chunks_used": 0}

    if not resume_text or not resume_text.strip():
        meta["mode"] = "no_resume_text"
        return None, meta

    plain = resume_text.strip()
    if not settings.openai_api_key:
        excerpt = plain[:4000] + ("\n…" if len(plain) > 4000 else "")
        meta["mode"] = "fallback_first_chars"
        meta["chunks_used"] = 1
        return excerpt, meta

    query_text = truncate_for_embedding(
        f"{company}\n{job_title}\n{(job_description_excerpt or '')[:6000]}",
        settings.embedding_max_input_chars,
    )
    chunks = _chunk_text(plain)[:max_embedding_chunks]
    if not chunks:
        meta["mode"] = "empty_chunks"
        return None, meta

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        inputs = [
            query_text,
            *[
                truncate_for_embedding(c, settings.embedding_max_input_chars)
                for c in chunks
            ],
        ]
        resp = client.embeddings.create(model=settings.openai_embedding_model, input=inputs)
        vectors = [d.embedding for d in sorted(resp.data, key=lambda x: x.index)]
        qvec = vectors[0]
        cvecs = vectors[1:]
        scored = [(chunks[i], _cosine(qvec, cvecs[i])) for i in range(len(chunks))]
        scored.sort(key=lambda x: x[1], reverse=True)
        top = [t for t, _ in scored[:max_chunks]]
        meta["mode"] = "embedding_rag"
        meta["chunks_used"] = len(top)
        meta["chunk_scores"] = [round(s, 5) for _, s in scored[:max_chunks]]
        return "\n\n---\n\n".join(top), meta
    except Exception as e:  # noqa: BLE001
        meta["mode"] = "fallback_embed_error"
        meta["error"] = str(e)
        excerpt = plain[:4000] + ("\n…" if len(plain) > 4000 else "")
        return excerpt, meta


def _strip_html_to_plain(text: str, max_len: int = 10_000) -> str:
    s = re.sub(r"<[^>]+>", " ", text)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:max_len] if s else ""


def _live_jsearch_supplement_text(job: Job) -> str | None:
    """Fetch JSearch ``/job-details`` HTML/text when credentials exist; best-effort only."""
    if (job.listing_source or "").strip().lower() != "jsearch":
        return None
    ext = (job.external_ref or "").strip()
    if not ext:
        return None
    from app.jobs.providers.jsearch import fetch_jsearch_job_details_json
    from app.jobs.providers.jsearch_enrichment import jsearch_job_details_flat

    country = (settings.jsearch_country or "us").strip().lower()[:8] or "us"
    lang_raw = (settings.jsearch_language or "").strip()[:16]
    lang = lang_raw or None
    payload, err = fetch_jsearch_job_details_json(ext, country=country, language=lang)
    if err or not payload:
        return None
    flat = jsearch_job_details_flat(payload)
    parts: list[str] = []
    desc_raw = flat.get("job_description")
    if isinstance(desc_raw, str) and desc_raw.strip():
        parts.append(_strip_html_to_plain(desc_raw, 9000))
    bullets = flat.get("job_highlights") or flat.get("highlights")
    if isinstance(bullets, list):
        for item in bullets[:20]:
            if isinstance(item, str) and item.strip():
                parts.append(f"• {item.strip()[:500]}")
            elif isinstance(item, dict):
                t = str(item.get("title") or item.get("headline") or "").strip()
                b = str(item.get("text") or item.get("description") or "").strip()
                line = f"• {t}: {b}".strip() if t and b else (f"• {t or b}".strip())
                if line:
                    parts.append(line[:800])
    out = "\n".join(p for p in parts if p).strip()
    return out[:10_000] if out else None


def _merge_catalog_with_live_jsearch(job: Job, catalog_desc: str | None) -> str | None:
    cat = catalog_desc.strip() if catalog_desc and catalog_desc.strip() else ""
    live = _live_jsearch_supplement_text(job)
    if not live:
        return cat[:12000] if cat else None
    if not cat:
        return live[:12000]
    if live in cat or cat in live:
        return cat[:12000]
    return f"{cat}\n\n---\n\n[RapidAPI / JSearch live posting]\n{live}".strip()[:12000]


def load_job_description_for_application(
    db: Session, source_url: str | None, job_id: UUID | None = None
) -> str | None:
    """Best-effort job description from catalog Job (by id or source_url match).

    For ``listing_source=jsearch`` rows with ``external_ref``, merges in live JSearch ``/job-details``
    text (when RapidAPI credentials are configured) so interview prep and agents see full posting
    copy, not only what was stored at ingest time.
    """
    from sqlalchemy import select

    from app.models.job import Job

    if job_id is not None:
        job_by_id = db.get(Job, job_id)
        if job_by_id is not None:
            base = job_by_id.description.strip()[:12000] if job_by_id.description else None
            return _merge_catalog_with_live_jsearch(job_by_id, base)
    if not source_url:
        return None
    job = db.execute(select(Job).where(Job.source_url == source_url).limit(1)).scalar_one_or_none()
    if job is None:
        return None
    base = job.description.strip()[:12000] if job.description else None
    return _merge_catalog_with_live_jsearch(job, base)
