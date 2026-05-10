"""
RAG-style context for interview prep: retrieve résumé snippets most similar to the role query.

Uses OpenAI embeddings with batched inputs (query + overlapping résumé chunks). Falls back to a
single excerpt when embeddings are unavailable.
"""

from __future__ import annotations

import math
from typing import Any

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
        inputs = [query_text, *[truncate_for_embedding(c, settings.embedding_max_input_chars) for c in chunks]]
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


def load_job_description_for_application(db: Session, source_url: str | None) -> str | None:
    """Best-effort job description from linked Job row when source_url matches."""
    if not source_url:
        return None
    from sqlalchemy import select

    from app.models.job import Job

    job = db.execute(select(Job).where(Job.source_url == source_url).limit(1)).scalar_one_or_none()
    if job is None or not job.description:
        return None
    return job.description.strip()[:12000]
