from __future__ import annotations

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
        pytest.skip(f"PostgreSQL not reachable (start Postgres + run migrations): {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"job-feedback-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_hide_feedback_excludes_job_from_feed() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    job_id = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=job_id,
                company="Acme",
                title="Intern",
                location="Remote",
                tags=["intern"],
                listing_source="jsearch",
            )
        )
        db.commit()

    try:
        r1 = client.get("/jobs/feed?limit=50", headers=headers)
        assert r1.status_code == 200, r1.text
        ids1 = {row["job"]["id"] for row in r1.json()}
        assert str(job_id) in ids1

        r2 = client.post(
            f"/jobs/{job_id}/feedback",
            headers=headers,
            json={"action": "hide", "reason": "not relevant"},
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["job_id"] == str(job_id)
        assert r2.json()["action"] == "hide"

        r3 = client.get("/jobs/feed?limit=50", headers=headers)
        assert r3.status_code == 200, r3.text
        ids3 = {row["job"]["id"] for row in r3.json()}
        assert str(job_id) not in ids3
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == job_id))
            db.commit()


def test_clear_feedback_restores_job_in_feed() -> None:
    client = TestClient(app)
    token, _user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    job_id = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=job_id,
                company="Beta",
                title="Data Entry Coordinator",
                location="Remote",
                tags=[],
                listing_source="jsearch",
            )
        )
        db.commit()

    try:
        client.post(f"/jobs/{job_id}/feedback", headers=headers, json={"action": "hide"})
        r1 = client.get("/jobs/feed?limit=50", headers=headers)
        ids1 = {row["job"]["id"] for row in r1.json()}
        assert str(job_id) not in ids1

        r2 = client.delete(f"/jobs/{job_id}/feedback", headers=headers)
        assert r2.status_code == 200, r2.text

        r3 = client.get("/jobs/feed?limit=50", headers=headers)
        ids3 = {row["job"]["id"] for row in r3.json()}
        assert str(job_id) in ids3
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == job_id))
            db.commit()
