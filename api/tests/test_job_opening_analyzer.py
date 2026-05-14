"""Job Opening Analyzer RapidAPI client + POST route."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.settings import settings
from app.db import engine
from app.integrations.job_opening_analyzer import post_compute_similarity
from app.main import app
from app.security import decode_access_token


@pytest.fixture
def postgres_client() -> TestClient:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except (OperationalError, OSError) as exc:
        pytest.skip(f"PostgreSQL not reachable: {exc}")
    return TestClient(app)


def _signup(client: TestClient) -> str:
    email = f"joa-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    decode_access_token(token)
    return token


def test_post_compute_similarity_no_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "job_opening_analyzer_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", None, raising=False)
    out, err = post_compute_similarity(pivot="hello", texts=["jd"])
    assert out is None
    assert err == "missing_job_opening_analyzer_credentials"


def test_post_compute_similarity_missing_pivot() -> None:
    out, err = post_compute_similarity(pivot="   ", texts=["x"])
    assert out is None
    assert err == "missing_pivot"


def test_post_compute_similarity_missing_texts(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    out, err = post_compute_similarity(pivot="resume", texts=[])
    assert out is None
    assert err == "missing_texts"


def test_post_compute_similarity_ok_with_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)

    def fake_post(url: str, **kwargs: object) -> MagicMock:
        assert "compute_similarity" in url
        json_body = kwargs.get("json") or {}
        assert json_body.get("pivot") == "p"
        assert json_body.get("texts") == ["a", "b"]
        r = MagicMock()
        r.json.return_value = {"scores": [0.9, 0.1]}
        r.raise_for_status.return_value = None
        return r

    with patch("app.integrations.job_opening_analyzer.httpx.post", side_effect=fake_post):
        data, err = post_compute_similarity(pivot="p", texts=["a", "b"])
    assert err is None
    assert data == {"scores": [0.9, 0.1]}


def test_job_opening_analyzer_route_requires_auth() -> None:
    client = TestClient(app)
    r = client.post(
        "/integrations/job-opening-analyzer/compute-similarity",
        json={"pivot": "x", "texts": ["y"]},
    )
    assert r.status_code == 401


def test_job_opening_analyzer_route_503_when_unconfigured(
    postgres_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "job_opening_analyzer_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", None, raising=False)
    token = _signup(postgres_client)
    r = postgres_client.post(
        "/integrations/job-opening-analyzer/compute-similarity",
        headers={"Authorization": f"Bearer {token}"},
        json={"pivot": "resume body", "texts": ["job one"]},
    )
    assert r.status_code == 503
