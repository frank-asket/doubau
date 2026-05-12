from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.main import app
from app.models.idempotency_key import IdempotencyKey
from app.models.job import Job
from app.security import decode_access_token


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient, *, prefix: str = "idem") -> tuple[str, UUID, str]:
    email = f"{prefix}-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"])), email


def test_idempotency_replays_same_user_same_body(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    token, user_id, email = _signup(client)
    monkeypatch.setattr("app.api.jobs.settings.admin_ingestion_user_ids", email)
    headers = {
        "Authorization": f"Bearer {token}",
        "Idempotency-Key": f"job-create-{uuid4()}",
    }
    payload = {"company": "ReplayCo", "title": "Platform Engineer", "tags": ["python"]}

    created_job_ids: list[UUID] = []
    try:
        first = client.post("/jobs", json=payload, headers=headers)
        second = client.post("/jobs", json=payload, headers=headers)

        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert second.json()["id"] == first.json()["id"]

        created_job_ids.append(UUID(first.json()["id"]))
        with SessionLocal() as db:
            count = db.execute(
                text("SELECT count(*) FROM jobs WHERE company = 'ReplayCo'")
            ).scalar_one()
        assert count == 1
    finally:
        with SessionLocal() as db:
            if created_job_ids:
                db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            db.execute(delete(IdempotencyKey).where(IdempotencyKey.user_id == user_id))
            db.commit()


def test_idempotency_rejects_reuse_on_different_path(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    token, user_id, email = _signup(client, prefix="idem-target")
    monkeypatch.setattr("app.api.jobs.settings.admin_ingestion_user_ids", email)
    key = f"target-{uuid4()}"
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": key}
    payload = {"company": "TargetCo", "title": "Backend Engineer"}

    created_job_id: UUID | None = None
    try:
        first = client.post("/jobs", json=payload, headers=headers)
        assert first.status_code == 200, first.text
        created_job_id = UUID(first.json()["id"])

        reused = client.post(f"/jobs/{created_job_id}/events", json=payload, headers=headers)
        assert reused.status_code == 409
        assert reused.text == "Idempotency-Key reuse with different request target"
    finally:
        with SessionLocal() as db:
            if created_job_id is not None:
                db.execute(delete(Job).where(Job.id == created_job_id))
            db.execute(delete(IdempotencyKey).where(IdempotencyKey.user_id == user_id))
            db.commit()


def test_idempotency_scopes_clerk_token_to_existing_email(monkeypatch: pytest.MonkeyPatch) -> None:
    client = TestClient(app)
    _, user_id, email = _signup(client, prefix="idem-clerk")
    monkeypatch.setattr("app.api.jobs.settings.admin_ingestion_user_ids", email)

    async def fake_decode_any_access_token(_token: str) -> dict:
        return {"sub": "user_clerk123", "email": email}

    monkeypatch.setattr(
        "app.middleware.idempotency.decode_any_access_token",
        fake_decode_any_access_token,
    )
    monkeypatch.setattr("app.api.deps.decode_any_access_token", fake_decode_any_access_token)

    headers = {
        "Authorization": "Bearer clerk-token",
        "Idempotency-Key": f"clerk-{uuid4()}",
    }
    payload = {"company": "ClerkReplayCo", "title": "Product Engineer"}

    created_job_ids: list[UUID] = []
    try:
        first = client.post("/jobs", json=payload, headers=headers)
        second = client.post("/jobs", json=payload, headers=headers)

        assert first.status_code == 200, first.text
        assert second.status_code == 200, second.text
        assert second.json()["id"] == first.json()["id"]
        created_job_ids.append(UUID(first.json()["id"]))

        with SessionLocal() as db:
            count = db.execute(
                text("SELECT count(*) FROM jobs WHERE company = 'ClerkReplayCo'")
            ).scalar_one()
        assert count == 1
    finally:
        with SessionLocal() as db:
            if created_job_ids:
                db.execute(delete(Job).where(Job.id.in_(created_job_ids)))
            db.execute(delete(IdempotencyKey).where(IdempotencyKey.user_id == user_id))
            db.commit()
