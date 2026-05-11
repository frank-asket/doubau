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
    email = f"ws-sum-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_workspace_summary_ok() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/me/workspace-summary", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "email" in body
    assert body["applications_total"] == 0
    assert isinstance(body["applications_by_status"], dict)
