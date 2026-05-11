from __future__ import annotations

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
    email = f"checkin-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_check_in_roundtrip() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}", "content-type": "application/json"}

    r1 = client.post(
        "/me/check-ins",
        headers=headers,
        json={"mood": 4, "energy": 3, "notes": "Good day"},
    )
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["mood"] == 4
    assert body["energy"] == 3
    assert body["notes"] == "Good day"

    r2 = client.get("/me/check-ins?limit=5", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200, r2.text
    rows = r2.json()
    assert len(rows) >= 1
    assert rows[0]["id"] == body["id"]
