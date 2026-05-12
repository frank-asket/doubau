"""POST /jobs/cron/clear-catalog — same secret gate as queue-ingest."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_cron_clear_catalog_not_found_when_unconfigured(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.jobs as jobs_mod

    monkeypatch.setattr(jobs_mod.settings, "cron_ingest_secret", None, raising=False)
    r = client.post("/jobs/cron/clear-catalog", headers={"X-Doubow-Cron-Secret": "nope"})
    assert r.status_code == 404


def test_cron_clear_catalog_unauthorized_bad_secret(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.api.jobs as jobs_mod

    secret = "c" * 48
    monkeypatch.setattr(jobs_mod.settings, "cron_ingest_secret", secret, raising=False)
    r = client.post("/jobs/cron/clear-catalog", headers={"X-Doubow-Cron-Secret": "d" * 48})
    assert r.status_code == 401
