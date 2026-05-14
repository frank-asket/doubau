from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, engine
from app.main import app
from app.models.application import Application
from app.models.user import User
from app.security import decode_access_token


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"crm-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_get_application_detail_includes_crm_fields() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Globex", "job_title": "Engineer", "source_url": "https://example.com/job/globex"},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    when = datetime(2030, 6, 1, 12, 0, tzinfo=timezone.utc)
    with SessionLocal() as db:
        app_row = db.get(Application, UUID(app_id))
        assert app_row is not None
        app_row.notes = "Talked to recruiter."
        app_row.next_followup_at = when
        app_row.tags = ["stretch", "remote"]
        db.commit()

    r1 = client.get(f"/applications/{app_id}", headers=headers)
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["notes"] == "Talked to recruiter."
    assert body["tags"] == ["stretch", "remote"]
    assert body["next_followup_at"] is not None
    assert "job_description_excerpt" in body


def test_patch_application_updates_crm_fields() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Initech", "job_title": "Analyst", "source_url": None},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    fu = "2031-03-15T09:30:00+00:00"
    r1 = client.patch(
        f"/applications/{app_id}",
        headers=headers,
        json={"notes": "  Follow up on take-home  ", "next_followup_at": fu, "tags": ["visa", "priority"]},
    )
    assert r1.status_code == 200, r1.text
    assert r1.json()["notes"] == "Follow up on take-home"
    assert r1.json()["tags"] == ["visa", "priority"]

    with SessionLocal() as db:
        row = db.get(Application, UUID(app_id))
        assert row is not None
        assert row.next_followup_at is not None

    r2 = client.patch(
        f"/applications/{app_id}",
        headers=headers,
        json={"notes": None, "next_followup_at": None, "tags": []},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["notes"] is None
    assert r2.json()["next_followup_at"] is None
    assert r2.json()["tags"] is None

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass


def test_patch_clear_followup_clears_reminder_anchor() -> None:
    client = TestClient(app)
    token, user_id = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.post(
        "/applications",
        headers=headers,
        json={"company": "Soylent", "job_title": "Manager", "source_url": None},
    )
    assert r0.status_code == 200, r0.text
    app_id = r0.json()["id"]

    when = datetime(2032, 1, 5, 15, 0, tzinfo=timezone.utc)
    with SessionLocal() as db:
        row = db.get(Application, UUID(app_id))
        assert row is not None
        row.next_followup_at = when
        row.followup_notified_for_at = when
        db.commit()

    r1 = client.patch(f"/applications/{app_id}", headers=headers, json={"next_followup_at": None})
    assert r1.status_code == 200, r1.text

    with SessionLocal() as db:
        row = db.get(Application, UUID(app_id))
        assert row is not None
        assert row.next_followup_at is None
        assert row.followup_notified_for_at is None

    try:
        with SessionLocal() as db:
            db.execute(delete(Application).where(Application.user_id == user_id))
            db.execute(delete(User).where(User.id == user_id))
            db.commit()
    except Exception:
        pass
