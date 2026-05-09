from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.jobs.providers.schema import CanonicalJobIn


@runtime_checkable
class ProviderAdapter(Protocol):
    """Fetch remote listings and map each raw record to ``CanonicalJobIn``."""

    listing_source: str

    def fetch_canonical(self, *, max_rows: int) -> list[CanonicalJobIn]:
        """Return up to ``max_rows`` canonical jobs (caller handles caps per provider)."""
        ...
