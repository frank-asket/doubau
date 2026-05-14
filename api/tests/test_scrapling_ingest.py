from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn
from app.jobs.providers.scrapling import (
    extract_jsonld_jobs,
    fetch_ashby_job_board_canonical,
    fetch_greenhouse_board_canonical,
    fetch_lever_postings_canonical,
    fetch_scrapling_canonical,
    fetch_workday_cxs_canonical,
)
from app.tasks import ingest_scrapling_jobs


def test_scrapling_disabled_skips() -> None:
    with patch.object(settings, "scrapling_enabled", False):
        out = ingest_scrapling_jobs.run()

    assert out["status"] == "skipped_disabled"


def test_scrapling_fixture_json_path_loads_canonical(tmp_path) -> None:
    fixture = tmp_path / "jobs.json"
    fixture.write_text(
        json.dumps(
            {
                "jobs": [
                    {
                        "title": "Registered Nurse",
                        "company": "City Hospital",
                        "apply_url": "https://example.com/nurse",
                        "listing_source": "fixture",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    with patch.object(settings, "scrapling_enabled", True):
        with patch.object(settings, "scrapling_fixture_json_path", str(fixture)):
            with patch.object(settings, "scrapling_seed_urls", ""):
                with patch.object(settings, "scrapling_auto_greenhouse_board_seeds", False):
                    jobs, err = fetch_scrapling_canonical(10)

    assert err is None
    assert len(jobs) == 1
    assert jobs[0].title == "Registered Nurse"
    assert jobs[0].company == "City Hospital"


def test_extract_jsonld_jobposting_from_html() -> None:
    html = """
    <html><head>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Warehouse Associate",
        "hiringOrganization": {"name": "North Star Logistics"},
        "jobLocation": {"address": {"addressLocality": "Accra"}},
        "employmentType": "FULL_TIME",
        "datePosted": "2026-05-01T10:00:00Z",
        "description": "<p>Pick, pack, and ship orders.</p>",
        "url": "https://example.com/jobs/warehouse"
      }
      </script>
    </head></html>
    """

    jobs = extract_jsonld_jobs(html, page_url="https://example.com/jobs/warehouse")

    assert len(jobs) == 1
    assert jobs[0].title == "Warehouse Associate"
    assert jobs[0].company == "North Star Logistics"
    assert jobs[0].location == "Accra"
    assert jobs[0].listing_source == "scrapling_jsonld"


def test_fetch_greenhouse_board_maps_public_api() -> None:
    resp = MagicMock()
    resp.json.return_value = {
        "jobs": [
            {
                "id": 123,
                "title": "Customer Support Specialist",
                "absolute_url": "https://job-boards.greenhouse.io/acme/jobs/123",
                "location": {"name": "Remote"},
                "content": "<p>Help customers solve problems.</p>",
                "departments": [{"name": "Operations"}],
                "updated_at": "2026-05-10T12:00:00Z",
            }
        ]
    }
    resp.raise_for_status.return_value = None

    with patch("app.jobs.providers.scrapling.httpx.get", return_value=resp):
        jobs, err = fetch_greenhouse_board_canonical("acme", max_jobs=5, timeout_s=10)

    assert err is None
    assert len(jobs) == 1
    assert jobs[0].title == "Customer Support Specialist"
    assert jobs[0].company == "Acme"
    assert jobs[0].listing_source == "greenhouse"
    assert jobs[0].tags == ["Operations"]


def test_fetch_lever_postings_maps_public_json() -> None:
    resp = MagicMock()
    resp.json.return_value = [
        {
            "id": "abc",
            "text": "Barista",
            "hostedUrl": "https://jobs.lever.co/demo/uuid",
            "categories": {"location": "Paris", "team": "Retail"},
            "descriptionPlain": "Make coffee.",
            "workplaceType": "on-site",
        }
    ]
    resp.raise_for_status.return_value = None

    with patch("app.jobs.providers.scrapling.httpx.get", return_value=resp):
        jobs, err = fetch_lever_postings_canonical(
            "demo", api_origin="https://api.lever.co", max_jobs=5, timeout_s=10
        )

    assert err is None
    assert len(jobs) == 1
    assert jobs[0].title == "Barista"
    assert jobs[0].listing_source == "lever"
    assert jobs[0].location == "Paris"
    assert "Retail" in jobs[0].tags


def test_fetch_ashby_job_board_maps_jobs_array() -> None:
    resp = MagicMock()
    resp.json.return_value = {
        "jobs": [
            {
                "id": "j1",
                "title": "Analyst",
                "jobUrl": "https://jobs.ashbyhq.com/acme/j1",
                "applyUrl": "https://jobs.ashbyhq.com/acme/j1/application",
                "location": "Berlin",
                "department": "Finance",
                "publishedAt": "2026-01-15T10:00:00Z",
                "employmentType": "FullTime",
            }
        ]
    }
    resp.raise_for_status.return_value = None

    with patch("app.jobs.providers.scrapling.httpx.get", return_value=resp):
        jobs, err = fetch_ashby_job_board_canonical(
            "https://api.ashbyhq.com/posting-api/job-board/acme",
            max_jobs=5,
            timeout_s=10,
        )

    assert err is None
    assert len(jobs) == 1
    assert jobs[0].title == "Analyst"
    assert jobs[0].listing_source == "ashby"
    assert jobs[0].apply_url.startswith("https://jobs.ashbyhq.com/")


def test_fetch_workday_cxs_maps_job_postings() -> None:
    resp = MagicMock()
    resp.json.return_value = {
        "jobPostings": [
            {
                "title": "Mechanic",
                "externalPath": "/job/UK-London/Mechanic_R123",
                "locationsText": "London",
                "bulletFields": ["R123"],
            }
        ]
    }
    resp.raise_for_status.return_value = None

    url = "https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/AcmeCareers/jobs"
    with patch("app.jobs.providers.scrapling.httpx.post", return_value=resp):
        jobs, err = fetch_workday_cxs_canonical(url, max_jobs=5, timeout_s=10)

    assert err is None
    assert len(jobs) == 1
    assert jobs[0].title == "Mechanic"
    assert jobs[0].listing_source == "workday_cxs"
    assert "/en-US/AcmeCareers/" in jobs[0].apply_url
    assert jobs[0].external_ref == "R123"


def test_fetch_scrapling_merges_lever_and_greenhouse_seeds(monkeypatch: pytest.MonkeyPatch) -> None:
    gh = MagicMock()
    gh.json.return_value = {
        "jobs": [
            {
                "id": 1,
                "title": "GH Role",
                "absolute_url": "https://job-boards.greenhouse.io/ghco/jobs/1",
                "updated_at": "2026-05-10T12:00:00Z",
            }
        ]
    }
    gh.raise_for_status.return_value = None

    lev = MagicMock()
    lev.json.return_value = [
        {
            "id": "x",
            "text": "Lever Role",
            "hostedUrl": "https://jobs.lever.co/lvco/x",
            "categories": {},
        }
    ]
    lev.raise_for_status.return_value = None

    def fake_get(url: str, **kwargs: object) -> MagicMock:
        if "greenhouse.io" in url:
            return gh
        if "lever.co" in url:
            return lev
        raise AssertionError(url)

    monkeypatch.setattr(settings, "scrapling_enabled", True)
    monkeypatch.setattr(settings, "scrapling_fixture_json_path", "")
    monkeypatch.setattr(settings, "scrapling_auto_greenhouse_board_seeds", False)
    monkeypatch.setattr(
        settings,
        "scrapling_seed_urls",
        "https://boards-api.greenhouse.io/v1/boards/ghco/jobs,https://api.lever.co/v0/postings/lvco",
    )
    monkeypatch.setattr(settings, "scrapling_greenhouse_seed_jobs_per_board", 10)

    with patch("app.jobs.providers.scrapling.httpx.get", side_effect=fake_get):
        jobs, err = fetch_scrapling_canonical(20)

    assert err is None
    titles = {j.title for j in jobs}
    assert "GH Role" in titles
    assert "Lever Role" in titles


def test_ingest_scrapling_wires_pipeline() -> None:
    canon = CanonicalJobIn(
        title="Teacher",
        company="Example School",
        apply_url="https://example.com/teacher",
        listing_source="scrapling_jsonld",
    )
    with patch.object(settings, "scrapling_enabled", True):
        with patch("app.tasks.fetch_scrapling_canonical", return_value=([canon], None)):
            with patch(
                "app.tasks.persist_canonical_jobs",
                return_value={"created": 1, "skipped": 0, "skip_reasons": {}},
            ):
                out = ingest_scrapling_jobs.run()

    assert out["status"] == "completed"
    assert out["created"] == 1
