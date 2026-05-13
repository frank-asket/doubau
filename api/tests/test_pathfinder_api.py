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
    email = f"pf-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_pathfinder_get_and_put() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}", "content-type": "application/json"}

    r0 = client.get("/me/pathfinder", headers={"Authorization": f"Bearer {token}"})
    assert r0.status_code == 200, r0.text
    body0 = r0.json()
    assert "wizard" in body0 and "paths" in body0
    assert isinstance(body0["paths"], list)

    r1 = client.put(
        "/me/pathfinder",
        headers=headers,
        json={
            "answers": {"northStar": "new_company", "constraint": "time"},
            "current_step": 1,
            "completed": False,
        },
    )
    assert r1.status_code == 200, r1.text
    w = r1.json()["wizard"]
    assert w["answers"]["northStar"] == "new_company"
    assert w["current_step"] == 1

    r2 = client.put(
        "/me/pathfinder",
        headers=headers,
        json={"completed": True, "current_step": 4},
    )
    assert r2.status_code == 200
    assert r2.json()["wizard"]["completed"] is True

    r3 = client.put("/me/pathfinder", headers=headers, json={"reset": True})
    assert r3.status_code == 200
    assert r3.json()["wizard"]["completed"] is False
    assert r3.json()["wizard"]["answers"] == {}
