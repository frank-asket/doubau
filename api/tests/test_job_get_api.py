from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from sqlalchemy import delete

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
    email = f"jobget-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_get_job_by_id() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="SpecCo",
                title="Spec Role",
                location="Remote",
                tags=["python"],
                description="Do things.",
            )
        )
        db.commit()
    try:
        r = client.get(f"/jobs/{jid}", headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["company"] == "SpecCo"
        assert body["title"] == "Spec Role"
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == jid))
            db.commit()


def test_jobs_feed_path_not_shadowed_by_get_job() -> None:
    """Regression: GET /jobs/{job_id} must not be registered before /jobs/feed or 'feed' is parsed as UUID → 422."""
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    r = client.get("/jobs/feed?limit=5", headers=headers)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
