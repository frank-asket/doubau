"""Glassdoor Real-time RapidAPI client + authenticated proxy route."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.settings import settings
from app.db import engine
from app.integrations.glassdoor_realtime import fetch_company_interview_details
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
    email = f"gd-rt-{uuid4()}@example.com"
    r = client.post("/auth/signup", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    decode_access_token(token)
    return token


def test_fetch_company_interview_details_no_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "glassdoor_realtime_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", None, raising=False)
    out, err = fetch_company_interview_details("19018219")
    assert out is None
    assert err == "missing_glassdoor_realtime_credentials"


def test_fetch_company_interview_details_invalid_id(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    out, err = fetch_company_interview_details("abc")
    assert out is None
    assert err == "invalid_interview_id"


def test_fetch_company_interview_details_ok_with_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)

    def fake_get(url: str, **kwargs: object) -> MagicMock:
        assert "interview-details" in url
        params = kwargs.get("params") or {}
        assert params.get("interviewId") == "19018219"
        r = MagicMock()
        r.json.return_value = {"interviewId": 19018219, "ok": True}
        r.raise_for_status.return_value = None
        return r

    with patch("app.integrations.glassdoor_realtime.httpx.get", side_effect=fake_get):
        data, err = fetch_company_interview_details("19018219")
    assert err is None
    assert data == {"interviewId": 19018219, "ok": True}


def test_glassdoor_interview_details_route_requires_auth() -> None:
    client = TestClient(app)
    r = client.get("/integrations/glassdoor/companies/interview-details?interview_id=1")
    assert r.status_code == 401


def test_glassdoor_interview_details_route_503_when_unconfigured(
    postgres_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "glassdoor_realtime_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", None, raising=False)

    token = _signup(postgres_client)
    r = postgres_client.get(
        "/integrations/glassdoor/companies/interview-details?interview_id=19018219",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 503


def test_glassdoor_interview_details_route_400_non_numeric(
    postgres_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    token = _signup(postgres_client)
    r = postgres_client.get(
        "/integrations/glassdoor/companies/interview-details?interview_id=not-a-number",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 400
