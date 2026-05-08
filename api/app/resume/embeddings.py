"""
OpenAI text embeddings for résumé text (Phase 1).

Uses ``text-embedding-3-small`` (1536 dimensions) by default, aligned with ``embedding_vector``
column and Alembic migration ``0007_pgvector_embedding``.
"""

from __future__ import annotations

from openai import OpenAI

from app.core.settings import settings


class EmbeddingError(Exception):
    """Raised when the embedding API fails after parse succeeded."""


def truncate_for_embedding(text: str, max_chars: int) -> str:
    t = text.strip()
    if len(t) <= max_chars:
        return t
    return t[:max_chars]


def embed_resume_text(text: str) -> list[float]:
    """
    Produce an embedding vector for the given plain text.

    Requires ``DOUBOW_OPENAI_API_KEY``. Raises EmbeddingError on API failures.
    """
    if not settings.openai_api_key:
        raise EmbeddingError("DOUBOW_OPENAI_API_KEY is not set")

    trimmed = truncate_for_embedding(text, settings.embedding_max_input_chars)
    if not trimmed:
        raise EmbeddingError("No text to embed")

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        resp = client.embeddings.create(model=settings.openai_embedding_model, input=trimmed)
    except Exception as e:
        raise EmbeddingError(str(e)) from e

    if not resp.data:
        raise EmbeddingError("Empty embedding response")

    vec = resp.data[0].embedding
    if len(vec) != settings.embedding_dimensions:
        raise EmbeddingError(
            f"Unexpected embedding length {len(vec)} (expected {settings.embedding_dimensions})",
        )
    return vec
