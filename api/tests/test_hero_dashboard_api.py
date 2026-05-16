from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal
from app.db import engine
from app.main import app
from app.models.job import Job
from app.security import decode_access_token
from app.services.hero_dashboard import display_name_from_email


@pytest.fixture
def _require_postgres() -> None:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"hero-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    user_id = UUID(str(payload["sub"]))
    return token, user_id


def test_display_name_from_email() -> None:
    assert display_name_from_email("robert.smith@example.com") == "Robert Smith"
    assert display_name_from_email("a@b.co") == "A"


def test_hero_dashboard_shape(_require_postgres: None) -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    r = client.get("/me/hero-dashboard", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()

    assert body["display_name"]
    assert body["subscription"]["show_upgrade_banner"] is True
    assert len(body["metrics"]["career_score"]["series_14d"]) == 14
    assert len(body["metrics"]["skills_growth"]["series_14d"]) == 14
    assert body["metrics"]["career_score"]["unit"] == "points"
    assert body["metrics"]["skills_growth"]["unit"] == "on your CV"
    assert isinstance(body["career_goals"], list)
    assert len(body["application_trends"]["buckets"]) == 8
    assert body["algorithm_version"] == 1
    assert isinstance(body["top_picks"], list)


def test_hero_dashboard_top_picks_include_rapidapi_ingest_fields(_require_postgres: None) -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}
    jid = uuid4()
    legacy_jid = uuid4()
    with SessionLocal() as db:
        db.add(
            Job(
                id=jid,
                company="RapidAPI Picks Co",
                title="Dashboard Picks Engineer",
                location="Remote",
                seniority="Senior",
                employment_type="Full-time",
                description="Build job discovery systems.",
                tags=["remote"],
                source_url="https://example.com/rapidapi-pick",
                listing_source="jsearch",
                employer_logo_url="https://cdn.example.com/rapidapi-picks.png",
            )
        )
        db.add(
            Job(
                id=legacy_jid,
                company="Legacy Picks Co",
                title="Legacy Dashboard Role",
                location="Remote",
                description="Should not power dashboard top picks.",
                tags=[],
                source_url="https://legacy.example.com/job",
                listing_source="legacy_source",
            )
        )
        db.commit()
    try:
        r = client.get("/me/hero-dashboard", headers=headers)
        assert r.status_code == 200, r.text
        picks = r.json()["top_picks"]
        pick = next((p for p in picks if p["job_id"] == str(jid)), None)
        assert pick is not None
        assert pick["listing_source"] == "jsearch"
        assert pick["employer_logo_url"] == "https://cdn.example.com/rapidapi-picks.png"
        assert str(legacy_jid) not in {p["job_id"] for p in picks}
    finally:
        with SessionLocal() as db:
            db.query(Job).filter(Job.id.in_([jid, legacy_jid])).delete(synchronize_session=False)
            db.commit()
