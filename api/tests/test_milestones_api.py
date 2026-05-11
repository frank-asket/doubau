from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import engine
from app.main import app
from app.security import decode_access_token


@pytest.fixture(autouse=True)
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"ms-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_milestones_crud() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}", "content-type": "application/json"}

    r1 = client.post(
        "/me/milestones",
        headers=headers,
        json={"title": "Ship portfolio", "status": "in_progress", "due_date": str(date.today())},
    )
    assert r1.status_code == 200, r1.text
    mid = r1.json()["id"]

    r2 = client.get("/me/milestones", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, r2.text
    assert any(m["id"] == mid for m in r2.json())

    r3 = client.patch(f"/me/milestones/{mid}", headers=headers, json={"status": "done"})
    assert r3.status_code == 200, r3.text
    assert r3.json()["status"] == "done"
