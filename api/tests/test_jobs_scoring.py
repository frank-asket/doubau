from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.jobs import (
    _require_ingestion_admin,
    _score_job_heuristic,
    _score_reason,
)
from app.models.job import Job
from app.models.user import User


def test_student_jobs_rank_internships_higher() -> None:
    intern = Job(company="A", title="Software Intern", tags=["intern"])
    senior = Job(company="B", title="Senior Software Engineer", tags=["senior"])

    assert _score_job_heuristic(
        job=intern, persona="student", focus=["find_jobs"]
    ) > _score_job_heuristic(job=senior, persona="student", focus=["find_jobs"])


def test_score_reason_explains_match_components() -> None:
    reason = _score_reason(
        similarity=0.72,
        location_score_=1.0,
        seniority_score_=0.9,
        recency_score__=0.2,
        feedback_adjustment=0.0,
    )

    assert "résumé" in reason
    assert "location" in reason


def test_bulk_ingestion_admin_guard_allows_configured_email(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = User(id=uuid4(), email="admin@example.com", password_hash="x")
    monkeypatch.setattr("app.api.jobs.settings.admin_ingestion_user_ids", "admin@example.com")

    _require_ingestion_admin(user)


def test_bulk_ingestion_admin_guard_blocks_unlisted_user(monkeypatch: pytest.MonkeyPatch) -> None:
    user = User(id=uuid4(), email="user@example.com", password_hash="x")
    monkeypatch.setattr("app.api.jobs.settings.admin_ingestion_user_ids", "admin@example.com")

    with pytest.raises(HTTPException) as exc:
        _require_ingestion_admin(user)

    assert exc.value.status_code == 403
