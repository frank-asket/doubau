"""``score_job`` wraps the shared embedding pipeline and exposes ``match_embedding_ready``."""

from __future__ import annotations

from unittest.mock import patch

from app.tasks import score_job


def test_score_job_adds_match_embedding_ready_when_embedded() -> None:
    with patch(
        "app.tasks._embed_job_sync",
        return_value={"job_id": "abc", "status": "embedded"},
    ):
        out = score_job.apply(args=("abc",)).get(timeout=10)
    assert out["status"] == "embedded"
    assert out["match_embedding_ready"] is True


def test_score_job_match_embedding_ready_false_when_skipped() -> None:
    with patch(
        "app.tasks._embed_job_sync",
        return_value={"job_id": "abc", "status": "skipped_no_openai"},
    ):
        out = score_job.apply(args=("abc",)).get(timeout=10)
    assert out["match_embedding_ready"] is False
