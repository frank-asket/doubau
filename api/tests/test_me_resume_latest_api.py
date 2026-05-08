"""
Integration tests for GET /me/resume/latest.

Requires PostgreSQL with migrations applied (same DB as DOUBOW_DATABASE_URL).
Tests are skipped when the DB is unreachable so unit-only runs still pass (pytest exit 0).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.main import app
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.security import decode_access_token


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable (start Postgres + run migrations): {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"resume-latest-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_resume_latest_401_without_auth() -> None:
    client = TestClient(app)
    resp = client.get("/me/resume/latest")
    assert resp.status_code == 401


def test_resume_latest_404_when_no_resume() -> None:
    client = TestClient(app)
    token, _user_id = _signup(client)
    resp = client.get("/me/resume/latest", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
    assert resp.json().get("detail") == "No resume uploaded yet"


def test_resume_latest_returns_most_recent_by_created_at() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    now = datetime.now(UTC)
    older_id = uuid4()
    newer_id = uuid4()

    with SessionLocal() as db:
        older = ResumeDocument(
            id=older_id,
            user_id=user_id,
            status=ResumeStatus.PARSED,
            file_name="older.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=10,
            s3_bucket="test-bucket",
            s3_key=f"resumes/{user_id}/older-{uuid4()}.docx",
            parsed_json={"text": "older body"},
            created_at=now - timedelta(hours=3),
            updated_at=now - timedelta(hours=3),
        )
        newer = ResumeDocument(
            id=newer_id,
            user_id=user_id,
            status=ResumeStatus.PARSED,
            file_name="newer.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=20,
            s3_bucket="test-bucket",
            s3_key=f"resumes/{user_id}/newer-{uuid4()}.docx",
            parsed_json={"text": "newer body"},
            created_at=now,
            updated_at=now,
        )
        db.add(older)
        db.add(newer)
        db.commit()

    try:
        resp = client.get("/me/resume/latest", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == str(newer_id)
        assert body["file_name"] == "newer.docx"
        assert (body.get("parsed_json") or {}).get("text") == "newer body"
    finally:
        with SessionLocal() as db:
            db.execute(delete(ResumeDocument).where(ResumeDocument.user_id == user_id))
            db.commit()


def test_resume_latest_does_not_include_other_users_documents() -> None:
    client = TestClient(app)
    token_a, _ = _signup(client)
    _token_b, user_b = _signup(client)

    rid = uuid4()
    with SessionLocal() as db:
        doc_b = ResumeDocument(
            id=rid,
            user_id=user_b,
            status=ResumeStatus.PARSED,
            file_name="other.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=5,
            s3_bucket="test-bucket",
            s3_key=f"resumes/{user_b}/only-{uuid4()}.docx",
            parsed_json={"text": "belongs to B"},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        db.add(doc_b)
        db.commit()

    try:
        resp = client.get("/me/resume/latest", headers={"Authorization": f"Bearer {token_a}"})
        assert resp.status_code == 404
    finally:
        with SessionLocal() as db:
            db.execute(delete(ResumeDocument).where(ResumeDocument.user_id == user_b))
            db.commit()
