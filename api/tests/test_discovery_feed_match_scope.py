"""Discovery feed: jobs visible + ``match_scope`` / ``remote_only`` query params."""

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
        pytest.skip(f"PostgreSQL not reachable: {exc}")


def _signup(client: TestClient) -> tuple[str, UUID]:
    email = f"discovery-feed-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    payload = decode_access_token(token)
    return token, UUID(str(payload["sub"]))


def test_feed_lists_jobs_and_remote_only_filters() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    remote_id = uuid4()
    onsite_id = uuid4()
    with SessionLocal() as db:
        db.add_all(
            [
                Job(
                    id=remote_id,
                    company="RemoteCo",
                    title="Engineer",
                    location="Remote (Worldwide)",
                    tags=["python"],
                    listing_source="jsearch",
                ),
                Job(
                    id=onsite_id,
                    company="ParisCo",
                    title="Engineer",
                    location="Paris, France",
                    tags=["python"],
                    listing_source="jsearch",
                ),
            ]
        )
        db.commit()
    try:
        r_all = client.get("/jobs/feed?limit=50", headers=headers)
        assert r_all.status_code == 200, r_all.text
        all_ids = {row["job"]["id"] for row in r_all.json()}
        assert str(remote_id) in all_ids
        assert str(onsite_id) in all_ids

        r_remote = client.get("/jobs/feed?limit=50&remote_only=true", headers=headers)
        assert r_remote.status_code == 200, r_remote.text
        remote_ids = {row["job"]["id"] for row in r_remote.json()}
        assert str(remote_id) in remote_ids
        assert str(onsite_id) not in remote_ids

        r_world = client.get("/jobs/feed?limit=50&match_scope=worldwide", headers=headers)
        assert r_world.status_code == 200, r_world.text
        assert isinstance(r_world.json(), list)

        r_west_africa = client.get("/jobs/feed?limit=50&match_scope=west_africa", headers=headers)
        assert r_west_africa.status_code == 200, r_west_africa.text
        assert isinstance(r_west_africa.json(), list)

        r_combo = client.get(
            "/jobs/feed?limit=50&match_scope=worldwide&remote_only=true",
            headers=headers,
        )
        assert r_combo.status_code == 200, r_combo.text
        combo_ids = {row["job"]["id"] for row in r_combo.json()}
        assert str(remote_id) in combo_ids
        assert str(onsite_id) not in combo_ids
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id.in_((remote_id, onsite_id))))
            db.commit()


def test_discovery_endpoints_exclude_non_rapidapi_sources() -> None:
    client = TestClient(app)
    token, _ = _signup(client)
    headers = {"Authorization": f"Bearer {token}"}

    rapid_id = uuid4()
    legacy_id = uuid4()
    with SessionLocal() as db:
        db.add_all(
            [
                Job(
                    id=rapid_id,
                    company="RapidCo",
                    title="RapidAPI Role",
                    location="Remote",
                    tags=["python"],
                    listing_source="jsearch",
                ),
                Job(
                    id=legacy_id,
                    company="LegacyCo",
                    title="RemoteOK Role",
                    location="Remote",
                    tags=["python"],
                    listing_source="remoteok",
                    source_url="https://remoteok.com/remote-jobs/legacy",
                ),
            ]
        )
        db.commit()
    try:
        feed = client.get("/jobs/feed?limit=100", headers=headers)
        assert feed.status_code == 200, feed.text
        feed_ids = {row["job"]["id"] for row in feed.json()}
        assert str(rapid_id) in feed_ids
        assert str(legacy_id) not in feed_ids

        listing = client.get("/jobs?limit=100", headers=headers)
        assert listing.status_code == 200, listing.text
        list_ids = {row["id"] for row in listing.json()}
        assert str(rapid_id) in list_ids
        assert str(legacy_id) not in list_ids

        summary = client.get("/jobs/catalog/summary", headers=headers)
        assert summary.status_code == 200, summary.text
        assert "remoteok" not in summary.json()["by_source"]
    finally:
        with SessionLocal() as db:
            db.execute(delete(Job).where(Job.id.in_((rapid_id, legacy_id))))
            db.commit()
