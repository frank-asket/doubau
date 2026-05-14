"""Catalog ingest search string from profile + résumé (JSearch / SerpAPI helpers)."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.settings import settings
from app.jobs.catalog_query_from_resume import build_catalog_job_search_query
from app.tasks import ingest_jsearch_jobs


def test_build_catalog_job_search_query_from_goals_job_search_query() -> None:
    q = build_catalog_job_search_query(
        goals={"job_search_query": "  ICU nurse night shift  "},
        parsed_json=None,
        extracted_excerpt=None,
    )
    assert q == "ICU nurse night shift"


def test_build_catalog_job_search_query_from_focus_list() -> None:
    q = build_catalog_job_search_query(
        goals={"focus": ["field sales", "B2B", ""]},
        parsed_json=None,
        extracted_excerpt=None,
    )
    assert "field sales" in q and "B2B" in q


def test_build_catalog_job_search_query_from_structured_headline_skills() -> None:
    q = build_catalog_job_search_query(
        goals=None,
        parsed_json={
            "structured_llm": {
                "headline": "Licensed electrician",
                "skills": ["Commercial wiring", "PLC"],
            }
        },
        extracted_excerpt=None,
    )
    assert "Licensed electrician" in q
    assert "Commercial wiring" in q


def test_build_catalog_job_search_query_from_excerpt_fallback() -> None:
    q = build_catalog_job_search_query(
        goals=None,
        parsed_json=None,
        extracted_excerpt="Warehouse lead\nSecond line ignored for truncation test " * 20,
    )
    assert q.startswith("Warehouse lead")


def test_ingest_jsearch_passes_query_override_to_fetch(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "jsearch_rapidapi_key", "k", raising=False)
    monkeypatch.setattr(settings, "jsearch_ingest_max_jobs", 12, raising=False)
    with patch("app.tasks.fetch_jsearch_canonical") as m:
        m.return_value = ([], None)
        ingest_jsearch_jobs.run(query_override="logistics coordinator remote")
    m.assert_called_once_with(12, query_override="logistics coordinator remote")
