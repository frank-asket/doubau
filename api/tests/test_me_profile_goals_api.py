"""Regression tests for ``PUT /me/profile`` goals (e.g. LinkedIn URL card in web app)."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

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


def _signup(client: TestClient, prefix: str) -> tuple[str, UUID]:
    email = f"{prefix}-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_put_profile_goals_sets_linkedin_profile_url_and_preserves_pathfinder() -> None:
    """Server merges ``goals`` JSON; pathfinder must survive a patch that only adds LinkedIn URL."""
    client = TestClient(app)
    token, _uid = _signup(client, "profile-goals")
    headers = {"Authorization": f"Bearer {token}"}

    r0 = client.put(
        "/me/profile",
        headers=headers,
        json={"goals": {"pathfinder": {"current_step": 1}, "focus": ["boost_linkedin"]}},
    )
    assert r0.status_code == 200, r0.text
    assert r0.json()["goals"]["pathfinder"] == {"current_step": 1}

    url = "https://www.linkedin.com/in/example-user"
    r1 = client.put(
        "/me/profile",
        headers=headers,
        json={"goals": {"linkedin_profile_url": url}},
    )
    assert r1.status_code == 200, r1.text
    body = r1.json()
    assert body["goals"]["linkedin_profile_url"] == url
    assert body["goals"]["pathfinder"] == {"current_step": 1}

    r2 = client.get("/me/profile", headers=headers)
    assert r2.status_code == 200, r2.text
    got = r2.json()["goals"]
    assert got["linkedin_profile_url"] == url
    assert got["pathfinder"] == {"current_step": 1}
