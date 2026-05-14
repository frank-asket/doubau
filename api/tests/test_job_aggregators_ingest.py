"""JSearch / SerpAPI ingest wiring and RSS URL list parsing."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.core.settings import settings
from app.jobs.rss_feed_list import split_job_board_rss_urls
from app.tasks import ingest_jsearch_jobs, ingest_job_board_rss_batch, ingest_serpapi_google_jobs


def test_jsearch_search_job_rows_accepts_list_or_wrapped_dict() -> None:
    from app.jobs.providers import jsearch as jm

    assert len(jm._jsearch_search_job_rows({"status": "OK", "data": [{"job_id": "1"}]})) == 1
    wrapped = {"status": "OK", "data": {"jobs": [{"job_id": "2", "job_title": "t", "employer_name": "e", "job_apply_link": "u"}]}}
    assert len(jm._jsearch_search_job_rows(wrapped)) == 1


def test_fetch_jsearch_canonical_hits_search_v2_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.jobs.providers.jsearch import fetch_jsearch_canonical

    monkeypatch.setattr(settings, "jsearch_rapidapi_key", "k", raising=False)
    monkeypatch.setattr(settings, "jsearch_job_search_endpoint", "search-v2", raising=False)
    monkeypatch.setattr(settings, "jsearch_ingest_max_jobs", 5, raising=False)

    captured: dict[str, str] = {}

    def fake_get(url: str, **kwargs: object) -> MagicMock:
        captured["url"] = url
        r = MagicMock()
        r.json.return_value = {
            "status": "OK",
            "data": [
                {
                    "job_id": "x",
                    "job_title": "Nurse",
                    "employer_name": "Med",
                    "job_apply_link": "https://example.com/j",
                }
            ],
        }
        r.raise_for_status.return_value = None
        return r

    with patch("app.jobs.providers.jsearch.httpx.get", side_effect=fake_get):
        jobs, err = fetch_jsearch_canonical(10)

    assert err is None
    assert len(jobs) == 1
    assert "/search-v2" in captured["url"]


def test_fetch_jsearch_job_details_errors_without_job_id() -> None:
    from app.jobs.providers.jsearch import fetch_jsearch_job_details_json

    out, err = fetch_jsearch_job_details_json("  ")
    assert out is None
    assert err == "missing_job_id"


def test_raw_to_canonical_jsearch_maps_publisher() -> None:
    from app.jobs.providers.jsearch import raw_to_canonical_jsearch

    row = {
        "job_title": "Backend Dev",
        "employer_name": "Acme",
        "job_apply_link": "https://boards.example/123",
        "job_publisher": "LinkedIn",
        "job_is_remote": True,
    }
    c = raw_to_canonical_jsearch(row)
    assert c is not None
    assert c.listing_source == "jsearch"
    assert "LinkedIn" in c.tags
    assert "remote" in c.tags


def test_raw_to_canonical_serpapi_google_job_apply_options() -> None:
    from app.jobs.providers.serpapi_google_jobs import raw_to_canonical_serpapi_google_job

    row = {
        "title": "PM",
        "company_name": "Globex",
        "apply_options": [{"title": "Indeed", "link": "https://indeed.example/apply"}],
        "via": "via Indeed",
    }
    c = raw_to_canonical_serpapi_google_job(row)
    assert c is not None
    assert c.listing_source == "serpapi_google_jobs"
    assert c.apply_url.startswith("https://")


def test_split_job_board_rss_urls() -> None:
    raw = "https://a.example/feed.xml\nhttps://b.example/jobs.atom|https://c.example/rss"
    out = split_job_board_rss_urls(raw)
    assert out == [
        "https://a.example/feed.xml",
        "https://b.example/jobs.atom",
        "https://c.example/rss",
    ]


def test_ingest_jsearch_skipped_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", None, raising=False)
    out = ingest_jsearch_jobs.run()
    assert out["status"] == "skipped_no_credentials"


def test_ingest_jsearch_uses_fallback_rapidapi_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", None, raising=False)
    monkeypatch.setattr(settings, "rapidapi_key", "rapid-shared", raising=False)
    monkeypatch.setattr(settings, "jsearch_ingest_max_jobs", 5, raising=False)

    from app.jobs.providers.schema import CanonicalJobIn

    jobs = [
        CanonicalJobIn(
            title="Eng",
            company="Co",
            apply_url="https://apply.example/1",
            listing_source="jsearch",
        )
    ]
    with patch("app.tasks.fetch_jsearch_canonical", return_value=(jobs, None)):
        with patch("app.tasks.persist_canonical_jobs", return_value={"created": 1, "skipped": 0}):
            out = ingest_jsearch_jobs.run()
    assert out["status"] == "completed"


def test_ingest_serpapi_skipped_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "serpapi_api_key", None, raising=False)
    out = ingest_serpapi_google_jobs.run()
    assert out["status"] == "skipped_no_credentials"


def test_ingest_jsearch_completed_with_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", "k", raising=False)
    monkeypatch.setattr(settings, "jsearch_ingest_max_jobs", 5, raising=False)

    from app.jobs.providers.schema import CanonicalJobIn

    jobs = [
        CanonicalJobIn(
            title="Eng",
            company="Co",
            apply_url="https://apply.example/1",
            listing_source="jsearch",
        )
    ]
    with patch("app.tasks.fetch_jsearch_canonical", return_value=(jobs, None)):
        with patch("app.tasks.persist_canonical_jobs", return_value={"created": 1, "skipped": 0}) as pp:
            out = ingest_jsearch_jobs.run()
    assert out["status"] == "completed"
    assert out["listing_source"] == "jsearch"
    pp.assert_called_once()


def test_ingest_serpapi_completed_with_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "serpapi_api_key", "k", raising=False)

    from app.jobs.providers.schema import CanonicalJobIn

    jobs = [
        CanonicalJobIn(
            title="PM",
            company="Acme",
            apply_url="https://apply.example/2",
            listing_source="serpapi_google_jobs",
        )
    ]
    with patch("app.tasks.fetch_serpapi_google_jobs_canonical", return_value=(jobs, None)):
        with patch("app.tasks.persist_canonical_jobs", return_value={"created": 1, "skipped": 0}) as pp:
            out = ingest_serpapi_google_jobs.run()
    assert out["status"] == "completed"
    pp.assert_called_once()


def test_ingest_job_board_rss_batch_skips_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "job_board_rss_urls", "", raising=False)
    out = ingest_job_board_rss_batch.run()
    assert out["status"] == "skipped_no_urls"


def test_ingest_job_board_rss_batch_queues(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        settings,
        "job_board_rss_urls",
        "https://feeds.example/a.xml\nhttps://feeds.example/b.xml",
        raising=False,
    )
    mock_delay = MagicMock()
    with patch("app.tasks.scrape_rss_feed.delay", mock_delay):
        out = ingest_job_board_rss_batch.run()
    assert out["status"] == "queued_children"
    assert out["queued_tasks"] == 2
    assert mock_delay.call_count == 2
