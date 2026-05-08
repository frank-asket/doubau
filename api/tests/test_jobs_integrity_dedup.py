"""Regression: duplicate ``source_url_hash`` under concurrency must not surface as 500."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from app.api.jobs import JobCreate, create_job
from app.models.job import Job


def test_create_job_returns_existing_after_integrity_error() -> None:
    """Simulates lost race: SELECT missed duplicate, INSERT hits unique index."""
    uid = uuid4()
    existing = MagicMock(spec=Job)
    existing.id = uid
    existing.company = "Acme"
    existing.title = "Engineer"
    existing.location = None
    existing.seniority = None
    existing.employment_type = None
    existing.description = None
    existing.tags = []
    existing.source_url = "https://jobs.example.com/role/1"

    db = MagicMock()
    db.scalar.side_effect = [None, existing]
    db.commit.side_effect = IntegrityError(
        "stmt",
        {},
        Exception("unique ix_jobs_source_url_hash_unique"),
    )

    payload = JobCreate(
        company="Other",
        title="Other title",
        source_url="https://jobs.example.com/role/1",
    )

    out = create_job(payload, db, MagicMock())

    assert out.id == uid
    assert out.company == "Acme"
    db.rollback.assert_called_once()
    assert db.scalar.call_count == 2
