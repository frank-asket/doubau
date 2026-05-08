"""Unit tests for résumé embedding helpers (OpenAI mocked)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.resume.embeddings import EmbeddingError, truncate_for_embedding


def test_truncate_for_embedding_respects_max() -> None:
    long = "x" * 40_000
    out = truncate_for_embedding(long, 1000)
    assert len(out) == 1000


def test_embed_resume_text_requires_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.resume import embeddings as emb

    monkeypatch.setattr(emb.settings, "openai_api_key", None)
    with pytest.raises(EmbeddingError, match="OPENAI_API_KEY"):
        emb.embed_resume_text("hello world")


@patch("app.resume.embeddings.OpenAI")
def test_embed_resume_text_success(
    mock_openai_cls: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.resume import embeddings as emb

    vec = [0.01] * 1536
    mock_openai_cls.return_value.embeddings.create.return_value = MagicMock(
        data=[MagicMock(embedding=vec)],
    )

    monkeypatch.setattr(emb.settings, "openai_api_key", "sk-test-local")
    monkeypatch.setattr(emb.settings, "embedding_dimensions", 1536)

    out = emb.embed_resume_text("Software engineer with Python experience.")
    assert len(out) == 1536
    assert out[0] == 0.01
