from __future__ import annotations

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.main import app
from app.models.job import Job
from app.security import decode_access_token


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"rapidapi-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_rapidapi_enrichment_unsupported_source() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="Co",
                title="Role",
                location="Remote",
                tags=[],
                listing_source="remoteok",
                external_ref="x",
            )
        )
        db.commit()
    try:
        r = client.get(f"/jobs/{jid}/rapidapi-enrichment", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["available"] is False
        assert body["reason"] == "unsupported_listing_source"
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()


def test_rapidapi_enrichment_jsearch_missing_external_ref() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="Co",
                title="Role",
                location="Remote",
                tags=[],
                listing_source="jsearch",
                external_ref=None,
            )
        )
        db.commit()
    try:
        r = client.get(f"/jobs/{jid}/rapidapi-enrichment", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["available"] is False
        assert body["reason"] == "missing_external_ref"
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()


def test_rapidapi_enrichment_jsearch_missing_credentials() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="Co",
                title="Role",
                location="Remote",
                tags=[],
                listing_source="jsearch",
                external_ref="job-123",
            )
        )
        db.commit()
    try:
        with patch(
            "app.api.jobs.fetch_jsearch_job_details_json",
            return_value=(None, "missing_jsearch_credentials"),
        ):
            r = client.get(f"/jobs/{jid}/rapidapi-enrichment", headers=headers)
        assert r.status_code == 503, r.text
        body = r.json()
        assert "detail" in body
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()


def test_rapidapi_enrichment_jsearch_success() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="Acme",
                title="Engineer",
                location="Remote",
                tags=[],
                listing_source="jsearch",
                external_ref="job-abc",
            )
        )
        db.commit()
    try:
        envelope = {
            "status": "OK",
            "data": {
                "employer_logo": "https://cdn.example/logo.png",
                "employer_website": "https://acme.example",
                "job_apply_link": "https://apply.example/1",
                "job_required_skills": ["Python", "SQL"],
                "job_highlights": ["Great team", {"title": "Perks", "text": "401k"}],
                "job_qna": [{"question": "Remote?", "answer": "Hybrid."}],
            },
        }
        with patch("app.api.jobs.fetch_jsearch_job_details_json", return_value=(envelope, None)):
            r = client.get(f"/jobs/{jid}/rapidapi-enrichment", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["available"] is True
        assert body["provider"] == "jsearch"
        assert body["employer_logo_url"] == "https://cdn.example/logo.png"
        assert body["employer_website"] == "https://acme.example"
        assert body["apply_link"] == "https://apply.example/1"
        assert "Python" in body["required_skills"]
        assert len(body["highlights"]) >= 2
        assert body["qna"] and body["qna"][0]["question"] == "Remote?"
        with SessionLocal() as db:
            saved = db.get(Job, jid)
            assert saved is not None
            assert saved.employer_logo_url == "https://cdn.example/logo.png"
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()
