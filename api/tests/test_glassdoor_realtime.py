"""Glassdoor Real-time RapidAPI client + authenticated proxy route."""

from __future__ import annotations

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, text
from sqlalchemy.exc import OperationalError

from app.core.settings import settings
from app.db import SessionLocal, engine
from app.integrations.glassdoor_realtime import (
    fetch_company_interview_details,
    fetch_glassdoor_realtime_resource,
    glassdoor_company_summary,
    glassdoor_interview_company_summary,
    normalize_company_key,
)
from app.main import app
from app.models.company_enrichment import CompanyEnrichment
from app.security import decode_access_token
from app.tasks import ingest_glassdoor_company_context, ingest_glassdoor_interview_details


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
    monkeypatch.setattr(settings, "glassdoor_realtime_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)

    def fake_get(url: str, **kwargs: object) -> MagicMock:
        assert url == "https://glassdoor-real-time.p.rapidapi.com/companies/interview-details"
        params = kwargs.get("params") or {}
        assert params.get("interviewId") == "19018219"
        headers = kwargs.get("headers") or {}
        assert headers.get("X-RapidAPI-Host") == "glassdoor-real-time.p.rapidapi.com"
        assert headers.get("X-RapidAPI-Key") == "k"
        assert headers.get("Content-Type") == "application/json"
        r = MagicMock()
        r.json.return_value = {"interviewId": 19018219, "ok": True}
        r.raise_for_status.return_value = None
        return r

    with patch("app.integrations.glassdoor_realtime.httpx.get", side_effect=fake_get):
        data, err = fetch_company_interview_details("19018219")
    assert err is None
    assert data == {"interviewId": 19018219, "ok": True}


def test_glassdoor_company_summary_extracts_employer_fields() -> None:
    payload = {
        "data": {
            "companies": [
                {
                    "employerId": 348371,
                    "employerName": "ENTRUST Solutions Group",
                    "squareLogoUrl": "https://media.glassdoor.com/logo.png",
                    "rating": "3.8",
                    "reviewCount": 42,
                    "interviewCount": 7,
                }
            ]
        }
    }
    out = glassdoor_company_summary("Entrust Solutions Group", payload)
    assert normalize_company_key(out["company_name"]) == "entrust solutions group"
    assert out["provider_ref"] == "348371"
    assert out["logo_url"] == "https://media.glassdoor.com/logo.png"
    assert out["rating"] == 3.8
    assert out["review_count"] == 42
    assert out["interview_count"] == 7


def test_glassdoor_interview_company_summary_extracts_employer() -> None:
    payload = {
        "data": {
            "employerInterviewDetails": {
                "id": 19018219,
                "employer": {
                    "id": 348371,
                    "name": "ENTRUST Solutions Group",
                    "squareLogoUrl": "https://media.glassdoor.com/logo.png",
                },
            }
        }
    }
    out = glassdoor_interview_company_summary("19018219", payload)
    assert out["company_name"] == "ENTRUST Solutions Group"
    assert out["provider_ref"] == "348371"
    assert out["logo_url"] == "https://media.glassdoor.com/logo.png"


def test_ingest_glassdoor_company_context_persists_snapshot(
    postgres_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = postgres_client
    payload = {
        "data": [
            {
                "employerId": 123,
                "employerName": "Acme Labs",
                "website": "https://acme.example",
                "squareLogoUrl": "https://cdn.example/acme.png",
            }
        ]
    }

    monkeypatch.setattr(
        "app.tasks.fetch_glassdoor_realtime_resource",
        lambda resource, params: (payload, None),
    )
    try:
        out = ingest_glassdoor_company_context(["Acme Labs"], limit=1)
        assert out["status"] == "completed"
        assert out["upserted"] == 1
        with SessionLocal() as db:
            row = db.scalar(
                text(
                    "select company_name from company_enrichments "
                    "where provider='glassdoor_realtime' and normalized_company='acme labs'"
                )
            )
            assert row == "Acme Labs"
    finally:
        with SessionLocal() as db:
            db.execute(
                delete(CompanyEnrichment).where(
                    CompanyEnrichment.provider == "glassdoor_realtime",
                    CompanyEnrichment.normalized_company == "acme labs",
                )
            )
            db.commit()


def test_ingest_glassdoor_interview_details_persists_employer(
    postgres_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _ = postgres_client
    payload = {
        "data": {
            "employerInterviewDetails": {
                "id": 19018219,
                "employer": {
                    "id": 348371,
                    "name": "ENTRUST Solutions Group",
                    "squareLogoUrl": "https://media.glassdoor.com/logo.png",
                },
            }
        }
    }

    monkeypatch.setattr(
        "app.tasks.fetch_company_interview_details",
        lambda interview_id: (payload, None),
    )
    try:
        out = ingest_glassdoor_interview_details(["19018219"])
        assert out["status"] == "completed"
        assert out["upserted"] == 1
        with SessionLocal() as db:
            row = db.get(
                CompanyEnrichment,
                db.scalar(
                    text(
                        "select id from company_enrichments "
                        "where provider='glassdoor_realtime' "
                        "and normalized_company='entrust solutions group'"
                    )
                ),
            )
            assert row is not None
            assert row.company_name == "ENTRUST Solutions Group"
            assert row.provider_ref == "348371"
            assert row.source == "interview_details"
    finally:
        with SessionLocal() as db:
            db.execute(
                delete(CompanyEnrichment).where(
                    CompanyEnrichment.provider == "glassdoor_realtime",
                    CompanyEnrichment.normalized_company == "entrust solutions group",
                )
            )
            db.commit()


def test_fetch_glassdoor_realtime_resource_rejects_unknown(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    out, err = fetch_glassdoor_realtime_resource("anything", {"q": "Apple"})
    assert out is None
    assert err == "unsupported_glassdoor_realtime_resource"


def test_fetch_glassdoor_realtime_resource_uses_configured_path(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    monkeypatch.setattr(settings, "glassdoor_realtime_jobs_path", "/jobs/search", raising=False)

    def fake_get(url: str, **kwargs: object) -> MagicMock:
        assert url.endswith("/jobs/search")
        params = kwargs.get("params") or {}
        assert params.get("query") == "designer"
        assert "empty" not in params
        r = MagicMock()
        r.json.return_value = {"jobs": [{"job_id": 1}]}
        r.raise_for_status.return_value = None
        return r

    with patch("app.integrations.glassdoor_realtime.httpx.get", side_effect=fake_get):
        data, err = fetch_glassdoor_realtime_resource("jobs", {"query": "designer", "empty": ""})
    assert err is None
    assert data == {"jobs": [{"job_id": 1}]}


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


def test_glassdoor_interview_details_route_accepts_rapidapi_alias(
    postgres_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    token = _signup(postgres_client)
    with patch(
        "app.api.integrations.fetch_company_interview_details",
        return_value=({"data": {"interviewId": 19018219}, "status": "OK"}, None),
    ) as m:
        r = postgres_client.get(
            "/integrations/glassdoor/companies/interview-details?interviewId=19018219",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert r.status_code == 200, r.text
    m.assert_called_once_with("19018219")


def test_glassdoor_category_routes_proxy(
    postgres_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "rapidapi_key", "k", raising=False)
    token = _signup(postgres_client)

    cases = [
        ("/integrations/glassdoor/conversations?q=Apple", "conversations"),
        ("/integrations/glassdoor/jobs?query=nurse&location=Chicago", "jobs"),
        ("/integrations/glassdoor/jobs/details?job_id=100", "job_details"),
        ("/integrations/glassdoor/companies?query=Apple", "companies"),
        ("/integrations/glassdoor/companies/details?company_id=1138", "company_details"),
        ("/integrations/glassdoor/companies/reviews?company_id=1138", "company_reviews"),
        ("/integrations/glassdoor/companies/interviews?company_id=1138", "company_interviews"),
        ("/integrations/glassdoor/salaries?job_title=Designer&location=Chicago", "salaries"),
    ]

    with patch(
        "app.api.integrations.fetch_glassdoor_realtime_resource",
        side_effect=lambda resource, params: ({"resource": resource, "params": params}, None),
    ) as m:
        for path, expected_resource in cases:
            r = postgres_client.get(path, headers={"Authorization": f"Bearer {token}"})
            assert r.status_code == 200, r.text
            assert r.json()["resource"] == expected_resource

    assert m.call_count == len(cases)
