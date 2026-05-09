"""Adzuna ingest task credentials gate and pipeline wiring."""

from __future__ import annotations

from unittest.mock import patch

from app.core.settings import settings
from app.jobs.providers.schema import CanonicalJobIn
from app.tasks import ingest_adzuna_jobs


def test_ingest_adzuna_skips_without_credentials() -> None:
    with patch.object(settings, "adzuna_app_id", None):
        with patch.object(settings, "adzuna_app_key", None):
            out = ingest_adzuna_jobs.run()

    assert out["status"] == "skipped_no_credentials"


def test_ingest_adzuna_wires_pipeline() -> None:
    canon = CanonicalJobIn(
        title="Dev",
        company="Co",
        apply_url="https://example.com/apply",
        listing_source="adzuna",
        external_ref="123",
    )
    with patch.object(settings, "adzuna_app_id", "x"):
        with patch.object(settings, "adzuna_app_key", "y"):
            with patch("app.tasks.fetch_adzuna_canonical", return_value=([canon], None)):
                with patch(
                    "app.tasks.persist_canonical_jobs",
                    return_value={"created": 1, "skipped": 0, "skip_reasons": {}},
                ):
                    out = ingest_adzuna_jobs.run()

    assert out["status"] == "completed"
    assert out["created"] == 1
