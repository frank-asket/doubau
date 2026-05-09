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
    email = f"match-metrics-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_track_event_and_metrics() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    job_id = uuid4()
    with SessionLocal() as db:
        db.add(Job(id=job_id, company="Acme", title="Analyst", location="Remote", tags=[]))
        db.commit()

    try:
        r1 = client.post(
            f"/jobs/{job_id}/events",
            headers=headers,
            json={"event_type": "impression", "meta": {"source": "feed"}},
        )
        assert r1.status_code == 200, r1.text

        r2 = client.post(
            f"/jobs/{job_id}/events",
            headers=headers,
            json={"event_type": "dismiss", "reason": "irrelevant_role"},
        )
        assert r2.status_code == 200, r2.text

        r3 = client.get("/me/match/metrics?days=30", headers=headers)
        assert r3.status_code == 200, r3.text
        body = r3.json()
        assert body["by_event_type"]["impression"] >= 1
        assert body["by_event_type"]["dismiss"] >= 1
        assert body["by_reason"]["irrelevant_role"] >= 1

        r4 = client.get("/me/match/events?limit=10", headers=headers)
        assert r4.status_code == 200, r4.text
        assert any(ev["job_id"] == str(job_id) for ev in r4.json())
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id == job_id))
            db.commit()

