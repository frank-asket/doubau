from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn
from app.jobs.providers.scrapling import (
    extract_jsonld_jobs,
    fetch_greenhouse_board_canonical,
    fetch_scrapling_canonical,
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
