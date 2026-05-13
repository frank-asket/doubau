from __future__ import annotations

from datetime import date
from uuid import UUID, uuid4

import calendar
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


def test_milestones_calendar_month() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}", "content-type": "application/json"}

    today = date.today()
    ym = f"{today.year}-{today.month:02d}"
    d_mid = date(today.year, today.month, min(15, calendar.monthrange(today.year, today.month)[1]))

    r1 = client.post(
        "/me/milestones",
        headers=headers,
        json={"title": "Due mid-month", "status": "todo", "due_date": str(d_mid)},
    )
    assert r1.status_code == 200, r1.text
    client.post(
        "/me/milestones",
        headers=headers,
        json={"title": "No date yet", "status": "in_progress"},
    )

    r_cal = client.get(f"/me/milestones/calendar?month={ym}", headers={"Authorization": f"Bearer {token}"})
    assert r_cal.status_code == 200, r_cal.text
    body = r_cal.json()
    assert body["month"] == ym
    assert isinstance(body["weeks"], list)
    assert len(body["weeks"]) >= 4
    assert isinstance(body["undated"], list)
    assert any(m["title"] == "No date yet" for m in body["undated"])
    flat = [m for w in body["weeks"] for c in w for m in c.get("milestones", [])]
    assert any(m["title"] == "Due mid-month" for m in flat)

    r_bad = client.get("/me/milestones/calendar?month=2026-13", headers={"Authorization": f"Bearer {token}"})
    assert r_bad.status_code == 400
