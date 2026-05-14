from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class CanonicalJobIn(BaseModel):
    """Normalized row produced by any ``ProviderAdapter`` before DB write."""

    title: str = Field(min_length=1, max_length=220)
    company: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=220)
    description: str | None = None
    apply_url: str = Field(min_length=1, max_length=1000)
    listing_source: str = Field(min_length=1, max_length=80)
    employment_type: str | None = Field(default=None, max_length=80)
    seniority: str | None = Field(default=None, max_length=80)
    tags: list[str] = Field(default_factory=list)
    employer_logo_url: str | None = Field(default=None, max_length=2000)
    external_ref: str | None = Field(default=None, max_length=200)
    source_posted_at: datetime | None = None

    def normalized_apply_url(self) -> str:
        return self.apply_url.strip()[:1000]
