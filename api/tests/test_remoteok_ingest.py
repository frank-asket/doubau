"""Remote OK ingest goes through ``fetch_remoteok_canonical`` + ``persist_canonical_jobs``."""

from __future__ import annotations

from unittest.mock import patch

from app.jobs.providers.schema import CanonicalJobIn
from app.tasks import ingest_remoteok_jobs


def test_ingest_remoteok_task_wires_pipeline() -> None:
    canon = CanonicalJobIn(
        title="Engineer",
        company="Acme",
        apply_url="https://remoteok.com/remote-jobs/x",
        listing_source="remoteok",
        employment_type="Remote",
    )
    with patch("app.tasks.fetch_remoteok_canonical", return_value=([canon], None)):
        with patch(
            "app.tasks.persist_canonical_jobs",
            return_value={"created": 1, "skipped": 0, "skip_reasons": {}},
        ):
            out = ingest_remoteok_jobs.run()

    assert out["status"] == "completed"
    assert out["created"] == 1
    assert out["listing_source"] == "remoteok"


def test_ingest_remoteok_fetch_error() -> None:
    with patch("app.tasks.fetch_remoteok_canonical", return_value=([], "boom")):
        out = ingest_remoteok_jobs.run()

    assert out["status"] == "fetch_failed"
    assert out["error"] == "boom"
