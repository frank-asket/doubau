from __future__ import annotations

from typing import Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.settings import settings
from app.db import SessionLocal
from app.jobs.providers.fingerprint import content_fingerprint_sha256
from app.jobs.providers.schema import CanonicalJobIn
from app.jobs.url_hash import hash_source_url
from app.models.job import Job


def _redis():
    import redis

    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def persist_canonical_job(job_in: CanonicalJobIn) -> tuple[Literal["created", "skipped"], str]:
    """
    Dedup by ``source_url`` hash, then Redis content-fingerprint (TTL), then insert.

    Fingerprint keys are scoped by ``listing_source`` so the same role advertised on
    Remote OK, Adzuna, and Scrapling can each create a row (different apply URLs and
    attribution). Re-ingest of the same row from the same provider still dedupes.

    Returns ``("created", job_id)`` or ``("skipped", reason)``.
    """
    url = job_in.normalized_apply_url()
    url_fp = hash_source_url(url)

    with SessionLocal() as db:
        existing_url = db.scalar(select(Job).where(Job.source_url_hash == url_fp))
        if existing_url is not None:
            return ("skipped", "duplicate_url")

    fp = content_fingerprint_sha256(
        title=job_in.title,
        company=job_in.company,
        location=job_in.location,
    )
    r = _redis()
    src = (job_in.listing_source or "unknown").strip().lower()[:80]
    fp_key = f"doubow:job_fp:{src}:{fp}"
    ttl = max(60, settings.job_content_fingerprint_ttl_seconds)
    if not r.set(fp_key, "1", nx=True, ex=ttl):
        return ("skipped", "duplicate_fingerprint")

    tags = list(job_in.tags or [])[:40]
    logo_u = (job_in.employer_logo_url or "").strip()
    employer_logo_url = logo_u[:2000] if logo_u.startswith(("http://", "https://")) else None
    job = Job(
        company=job_in.company[:200],
        title=job_in.title[:220],
        location=(job_in.location[:220] if job_in.location else None),
        seniority=job_in.seniority,
        employment_type=job_in.employment_type,
        description=(job_in.description[:12000] if job_in.description else None),
        tags=tags,
        employer_logo_url=employer_logo_url,
        source_url=url,
        source_url_hash=url_fp,
        listing_source=job_in.listing_source[:80],
        external_ref=(job_in.external_ref[:200] if job_in.external_ref else None),
        source_posted_at=job_in.source_posted_at,
    )

    try:
        with SessionLocal() as db:
            db.add(job)
            db.commit()
            db.refresh(job)
            jid = str(job.id)
    except IntegrityError:
        r.delete(fp_key)
        return ("skipped", "integrity_error")

    if settings.openai_api_key:
        from app.tasks import embed_job

        embed_job.delay(jid)
    return ("created", jid)


def persist_canonical_jobs(
    jobs: list[CanonicalJobIn],
    *,
    max_created: int,
) -> dict[str, object]:
    """Persist up to ``max_created`` new rows; stops early once cap reached."""
    created = 0
    skipped = 0
    reasons: dict[str, int] = {}
    for job_in in jobs:
        if created >= max_created:
            break
        status, detail = persist_canonical_job(job_in)
        if status == "created":
            created += 1
        else:
            skipped += 1
            reasons[detail] = reasons.get(detail, 0) + 1
    return {
        "created": created,
        "skipped": skipped,
        "skip_reasons": reasons,
    }
