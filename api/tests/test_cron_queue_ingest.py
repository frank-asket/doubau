"""POST /jobs/cron/queue-ingest — secret-based automation (no DB)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_cron_queue_ingest_not_found_when_unconfigured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.jobs as jobs_mod

    monkeypatch.setattr(jobs_mod.settings, "cron_ingest_secret", None, raising=False)
    r = client.post("/jobs/cron/queue-ingest", headers={"X-Doubow-Cron-Secret": "nope"})
    assert r.status_code == 404


def test_cron_queue_ingest_unauthorized_bad_secret(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.jobs as jobs_mod

    secret = "a" * 48
    monkeypatch.setattr(jobs_mod.settings, "cron_ingest_secret", secret, raising=False)
    r = client.post("/jobs/cron/queue-ingest", headers={"X-Doubow-Cron-Secret": "b" * 48})
    assert r.status_code == 401


def test_cron_queue_ingest_queues_tasks(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.jobs as jobs_mod

    secret = "z" * 40
    monkeypatch.setattr(jobs_mod.settings, "cron_ingest_secret", secret, raising=False)
    monkeypatch.setattr(jobs_mod.settings, "scrapling_enabled", False, raising=False)

    mock_js = MagicMock()
    mock_js.id = "task-jsearch"
    mock_aj = MagicMock()
    mock_aj.id = "task-active-jobs-db"

    monkeypatch.setattr(jobs_mod.ingest_jsearch_jobs_task, "delay", lambda: mock_js)
    monkeypatch.setattr(jobs_mod.ingest_active_jobs_db_task, "delay", lambda: mock_aj)

    r = client.post("/jobs/cron/queue-ingest", headers={"X-Doubow-Cron-Secret": secret})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["queued"]["jsearch"] == "task-jsearch"
    assert body["queued"]["active_jobs_db"] == "task-active-jobs-db"
    assert set(body["queued"]) == {"jsearch", "active_jobs_db"}
    assert "adzuna" not in body["queued"]
    assert "serpapi_google_jobs" not in body["queued"]
    assert "scrapling" not in body["queued"]
