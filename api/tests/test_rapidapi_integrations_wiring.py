"""RapidAPI status route + JSearch-enriched job description for interview prep."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.agents.interview_rag import load_job_description_for_application
from app.db import SessionLocal, engine
from app.main import app


def _pg_or_skip() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def test_rapidapi_status_route_authenticated(monkeypatch: pytest.MonkeyPatch) -> None:
    _pg_or_skip()
    from app.core import settings as settings_mod

    monkeypatch.setattr(settings_mod.settings, "rapidapi_key", "shared", raising=False)
    monkeypatch.setattr(settings_mod.settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings_mod.settings, "active_jobs_db_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings_mod.settings, "glassdoor_realtime_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings_mod.settings, "job_opening_analyzer_rapidapi_key", None, raising=False)

    client = TestClient(app)
    email = f"rapi-status-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    sr = client.get("/integrations/rapidapi/status", headers={"Authorization": f"Bearer {token}"})
    assert sr.status_code == 200, sr.text
    body = sr.json()
    assert body["shared_rapidapi_key_configured"] is True
    assert body["jsearch_configured"] is True
    assert body["glassdoor_realtime_configured"] is True


def test_rapidapi_status_requires_auth() -> None:
    client = TestClient(app)
    r = client.get("/integrations/rapidapi/status")
    assert r.status_code == 401


def test_load_job_description_merges_jsearch_live() -> None:
    _pg_or_skip()
    from app.models.job import Job

    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="Co",
                title="Role",
                location="Remote",
                tags=[],
                description="Short catalog blurb.",
                listing_source="jsearch",
                external_ref="job-xyz",
            )
        )
        db.commit()
    try:
        fake_payload = {
            "status": "OK",
            "data": {
                "job_description": "<p>Longer live HTML from RapidAPI.</p>",
                "job_highlights": ["Benefit A"],
            },
        }

        with SessionLocal() as db:
            with patch("app.jobs.providers.jsearch.fetch_jsearch_job_details_json", return_value=(fake_payload, None)):
                out = load_job_description_for_application(db, None, jid)
        assert out is not None
        assert "Short catalog blurb" in out
        assert "Longer live HTML" in out
        assert "RapidAPI / JSearch live posting" in out
        assert "Benefit A" in out
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()


def test_load_job_description_remoteok_no_extra_call() -> None:
    _pg_or_skip()
    from app.models.job import Job

    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="Co",
                title="Role",
                location="Remote",
                tags=[],
                description="Only this.",
                listing_source="remoteok",
                external_ref="slug-1",
            )
        )
        db.commit()
    try:
        with patch("app.jobs.providers.jsearch.fetch_jsearch_job_details_json") as m:
            with SessionLocal() as db:
                out = load_job_description_for_application(db, None, jid)
        m.assert_not_called()
        assert out == "Only this."
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()
