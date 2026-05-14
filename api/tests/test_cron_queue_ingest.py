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

    mock_ro = MagicMock()
    mock_ro.id = "task-remoteok"
    mock_ad = MagicMock()
    mock_ad.id = "task-adzuna"
    mock_js = MagicMock()
    mock_js.id = "task-jsearch"
    mock_sp = MagicMock()
    mock_sp.id = "task-serpapi"
    mock_rss = MagicMock()
    mock_rss.id = "task-rss"

    monkeypatch.setattr(jobs_mod.ingest_remoteok_jobs_task, "delay", lambda: mock_ro)
    monkeypatch.setattr(jobs_mod.ingest_adzuna_jobs_task, "delay", lambda: mock_ad)
    monkeypatch.setattr(jobs_mod.ingest_jsearch_jobs_task, "delay", lambda: mock_js)
    monkeypatch.setattr(jobs_mod.ingest_serpapi_google_jobs_task, "delay", lambda: mock_sp)
    monkeypatch.setattr(jobs_mod.ingest_job_board_rss_batch_task, "delay", lambda: mock_rss)

    r = client.post("/jobs/cron/queue-ingest", headers={"X-Doubow-Cron-Secret": secret})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["queued"]["remoteok"] == "task-remoteok"
    assert body["queued"]["adzuna"] == "task-adzuna"
    assert body["queued"]["jsearch"] == "task-jsearch"
    assert body["queued"]["serpapi_google_jobs"] == "task-serpapi"
    assert body["queued"]["job_board_rss_batch"] == "task-rss"
    assert "scrapling" not in body["queued"]
