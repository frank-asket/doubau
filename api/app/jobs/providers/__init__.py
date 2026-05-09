"""Provider adapters: fetch listings → canonical schema → persist (Phase 2 / v1 ingestion)."""

from app.jobs.providers.schema import CanonicalJobIn

__all__ = ["CanonicalJobIn"]
