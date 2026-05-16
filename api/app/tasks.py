from __future__ import annotations

import json
import logging
import re
import time
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
import redis
from celery.signals import task_failure
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.agents.outreach import generate_email_draft_content, generate_linkedin_draft_content
from app.celery_app import celery_app
from app.core.settings import settings
from app.db import SessionLocal
from app.integrations.glassdoor_realtime import (
    fetch_company_interview_details,
    fetch_glassdoor_realtime_resource,
    glassdoor_company_summary,
    glassdoor_interview_company_summary,
    normalize_company_key,
)
from app.jobs.html_snippet import extract_title_from_html
from app.jobs.providers.active_jobs_db import fetch_active_jobs_db_canonical
from app.jobs.providers.adzuna import fetch_adzuna_canonical
from app.jobs.providers.jsearch import fetch_jsearch_canonical
from app.jobs.providers.persist import persist_canonical_jobs
from app.jobs.providers.scrapling import fetch_scrapling_canonical
from app.jobs.providers.serpapi_google_jobs import fetch_serpapi_google_jobs_canonical
from app.jobs.rss_feed_list import split_job_board_rss_urls
from app.jobs.rss_links import extract_feed_entry_links
from app.jobs.url_hash import hash_source_url
from app.llm.logging import record_llm_interaction
from app.models.application import Application, ApplicationStatus
from app.models.company_enrichment import CompanyEnrichment
from app.models.job import Job
from app.models.outreach_draft import DraftStatus, OutreachDraft
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.models.user import User
from app.resume.claude_structure import claude_structure_resume_text
from app.resume.embeddings import EmbeddingError, embed_resume_text
from app.resume.llm_structure import (
    ResumeLLMStructureError,
    openai_structure_resume_text,
)
from app.resume.openrouter_structure import openrouter_structure_resume_text
from app.resume.parser import ResumeParseError, parse_docx_bytes, parse_pdf_bytes
from app.resume.structure import structure_resume_text
from app.storage.s3 import ensure_bucket, s3_client

log = logging.getLogger(__name__)


def _run_llm_resume_structure(text: str) -> dict[str, object]:
    """
    Pick OpenRouter, Claude, and/or OpenAI per ``resume_structuring_provider``.

    Returns structured fields plus ``_provider``, or ``{"error": ...}``.
    """
    prov = settings.resume_structuring_provider
    errs: list[str] = []

    def try_claude() -> dict[str, object] | None:
        if not settings.anthropic_api_key:
            return None
        try:
            data = claude_structure_resume_text(text)
            return {"_provider": "claude", **data}
        except ResumeLLMStructureError as e:
            errs.append(f"claude:{e}")
            return None

    def try_openai() -> dict[str, object] | None:
        if not settings.openai_api_key:
            return None
        try:
            data = openai_structure_resume_text(text)
            return {"_provider": "openai", **data}
        except ResumeLLMStructureError as e:
            errs.append(f"openai:{e}")
            return None

    def try_openrouter() -> dict[str, object] | None:
        if not settings.openrouter_api_key:
            return None
        try:
            data = openrouter_structure_resume_text(text)
            return {"_provider": "openrouter", **data}
        except ResumeLLMStructureError as e:
            errs.append(f"openrouter:{e}")
            return None

    if prov == "claude":
        r = try_claude()
        return r if r is not None else {"error": "; ".join(errs) if errs else "claude_unconfigured"}
    if prov == "openai":
        r = try_openai()
        return r if r is not None else {"error": "; ".join(errs) if errs else "openai_unconfigured"}
    if prov == "openrouter":
        r = try_openrouter()
        err_body = "; ".join(errs) if errs else "openrouter_unconfigured"
        return r if r is not None else {"error": err_body}
    r = try_openrouter() or try_claude() or try_openai()
    return r if r is not None else {"error": "; ".join(errs) if errs else "no_llm_keys"}


def _ingest_meta(*, started_at: datetime, ended_at: datetime) -> dict[str, Any]:
    return {
        "ingest_started_at": started_at.isoformat(),
        "ingest_ended_at": ended_at.isoformat(),
        "ingest_duration_ms": int((ended_at - started_at).total_seconds() * 1000),
    }


def _dlq_client() -> redis.Redis:
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


def _enforce_scrape_host_rate_limit(task_self: Any, *, host: str) -> None:
    """Redis token bucket per host per minute; Celery retry when over quota."""
    r = _dlq_client()
    bucket_key = int(time.time() // 60)
    rk = f"doubow:scrape:{host}:{bucket_key}"
    count = r.incr(rk)
    if count == 1:
        r.expire(rk, 180)
    if count > settings.scrape_max_requests_per_host_per_minute:
        raise task_self.retry(countdown=45)


def push_to_dlq(payload: dict[str, Any]) -> None:
    """
    Best-effort dead-letter recording.

    Celery doesn't provide a portable "DLQ" abstraction across brokers; for Phase 1 we persist
    failures into a Redis list key so we can alert/inspect and re-drive later.
    """
    try:
        r = _dlq_client()
        r.rpush(settings.dlq_redis_key, json.dumps(payload))
    except Exception:
        # Never let DLQ plumbing break the main task flow.
        pass


@task_failure.connect
def _on_task_failure(
    sender=None,
    task_id=None,
    exception=None,
    args=None,
    kwargs=None,
    traceback=None,
    einfo=None,
    **_,
):
    push_to_dlq(
        {
            "task": getattr(sender, "name", None),
            "task_id": task_id,
            "exception": repr(exception),
            "args": args,
            "kwargs": kwargs,
            "ts": datetime.now(UTC).isoformat(),
        }
    )


@celery_app.task(name="app.tasks.ping")
def ping() -> str:
    return "pong"


@celery_app.task(name="app.tasks.fail_once", autoretry_for=(), max_retries=0)
def fail_once() -> None:
    raise RuntimeError("boom")


def _embed_job_sync(job_id: str) -> dict[str, Any]:
    """Embed job fields with OpenAI; persist ``embedding_vector`` (shared by embed/score tasks)."""
    if not settings.openai_api_key:
        return {"job_id": job_id, "status": "skipped_no_openai"}

    with SessionLocal() as db:
        try:
            jid = UUID(job_id)
        except Exception:
            return {"job_id": job_id, "status": "invalid_id"}

        job = db.get(Job, jid)
        if job is None:
            return {"job_id": job_id, "status": "missing"}

        parts = [job.title, job.company, (job.description or "").strip()]
        text = "\n\n".join(p for p in parts if p)
        if not text.strip():
            return {"job_id": job_id, "status": "empty_text"}

        try:
            vec = embed_resume_text(text)
        except EmbeddingError as e:
            return {"job_id": job_id, "status": "embedding_failed", "error": str(e)}

        job.embedding_vector = vec
        job.embedding_model = settings.openai_embedding_model
        db.add(job)
        db.commit()
        return {"job_id": job_id, "status": "embedded"}


@celery_app.task(name="app.tasks.embed_job")
def embed_job(job_id: str) -> dict[str, Any]:
    """Embed job title+company+description with OpenAI; fill ``embedding_vector``."""
    return _embed_job_sync(job_id)


@celery_app.task(name="app.tasks.scrape_job", bind=True, max_retries=3)
def scrape_job(self, url: str) -> dict[str, Any]:
    """
    Fetch a job posting URL, store raw HTML in S3, upsert ``jobs`` row (dedup by URL hash),
    enqueue embedding. Rate-limited per host via Redis.
    """
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = parsed.netloc or ""
    if not host and parsed.path:
        host = parsed.path.split("/")[0]
    if not host:
        return {"status": "invalid_url", "url": url}

    _enforce_scrape_host_rate_limit(self, host=host)

    url_fingerprint = hash_source_url(url)
    with SessionLocal() as db:
        existing = db.scalar(select(Job).where(Job.source_url_hash == url_fingerprint))
        if existing is not None:
            return {"job_id": str(existing.id), "status": "deduplicated"}

    headers = {"User-Agent": "DoubowJobBot/1.0"}
    try:
        resp = httpx.get(
            url if "://" in url else f"https://{url}",
            timeout=30.0,
            headers=headers,
            follow_redirects=True,
        )
        resp.raise_for_status()
    except Exception as e:
        return {"status": "fetch_failed", "error": repr(e)}

    html = resp.text
    title_guess = extract_title_from_html(html) or "Imported role"
    desc = re.sub(r"<[^>]+>", " ", html)
    desc = re.sub(r"\s+", " ", desc).strip()[:12000]

    raw_key: str | None = f"{settings.s3_job_html_prefix}/{url_fingerprint}.html"
    try:
        cli = s3_client()
        ensure_bucket(cli, settings.s3_bucket_resumes)
        cli.put_object(
            Bucket=settings.s3_bucket_resumes,
            Key=raw_key,
            Body=html.encode("utf-8", errors="replace"),
            ContentType="text/html; charset=utf-8",
        )
    except Exception:
        raw_key = None

    with SessionLocal() as db:
        existing = db.scalar(select(Job).where(Job.source_url_hash == url_fingerprint))
        if existing is not None:
            return {"job_id": str(existing.id), "status": "deduplicated"}

        normalized_url = str(resp.url)[:1000]
        job = Job(
            company="Unknown",
            title=title_guess[:220],
            description=desc,
            source_url=normalized_url,
            source_url_hash=url_fingerprint,
            raw_html_s3_key=raw_key,
            tags=[],
            listing_source="http_fetch",
        )
        db.add(job)
        try:
            db.commit()
            db.refresh(job)
            jid = str(job.id)
        except IntegrityError:
            db.rollback()
            existing = db.scalar(select(Job).where(Job.source_url_hash == url_fingerprint))
            if existing is not None:
                return {"job_id": str(existing.id), "status": "deduplicated"}
            raise

    if settings.openai_api_key:
        embed_job.delay(jid)

    return {"job_id": jid, "status": "created", "source_url_hash": url_fingerprint}


@celery_app.task(name="app.tasks.scrape_rss_feed", bind=True, max_retries=3)
def scrape_rss_feed(self, feed_url: str) -> dict[str, Any]:
    """
    Fetch an RSS or Atom feed, enqueue ``scrape_job`` for each entry link (dedup still applies).
    Rate-limits the feed host for the initial GET (same bucket as ``scrape_job``).
    """
    normalized = feed_url if "://" in feed_url else f"https://{feed_url}"
    parsed = urlparse(normalized)
    host = parsed.netloc or ""
    if not host and parsed.path:
        host = parsed.path.split("/")[0]
    if not host:
        return {"status": "invalid_url", "url": feed_url}

    _enforce_scrape_host_rate_limit(self, host=host)

    headers = {"User-Agent": "DoubowJobBot/1.0"}
    try:
        resp = httpx.get(normalized, timeout=30.0, headers=headers, follow_redirects=True)
        resp.raise_for_status()
    except Exception as e:
        return {"status": "fetch_failed", "error": repr(e), "url": feed_url}

    base = str(resp.url)
    discovered = extract_feed_entry_links(resp.text, base_url=base)
    limit = max(1, settings.scrape_rss_max_entries)
    to_queue = discovered[:limit]

    queued = 0
    for link in to_queue:
        scrape_job.delay(link)
        queued += 1

    return {
        "status": "queued_children",
        "feed_url": feed_url,
        "resolved_feed_url": base,
        "links_discovered": len(discovered),
        "queued": queued,
    }


@celery_app.task(name="app.tasks.ingest_adzuna_jobs")
def ingest_adzuna_jobs() -> dict[str, Any]:
    """Adzuna REST search → ``CanonicalJobIn`` + persist (requires ``DOUBOW_ADZUNA_*`` keys)."""
    started_at = datetime.now(UTC)
    max_n = max(1, settings.adzuna_max_results)
    jobs, err = fetch_adzuna_canonical(max_n)
    if err == "missing_adzuna_credentials":
        ended_at = datetime.now(UTC)
        log.info("ingest_adzuna_jobs skipped_no_credentials")
        return {
            "status": "skipped_no_credentials",
            "detail": "Set DOUBOW_ADZUNA_APP_ID and DOUBOW_ADZUNA_APP_KEY",
            "listing_source": "adzuna",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }
    if err:
        ended_at = datetime.now(UTC)
        log.warning("ingest_adzuna_jobs fetch_failed error=%s", err)
        return {
            "status": "fetch_failed",
            "error": err,
            "listing_source": "adzuna",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    stats = persist_canonical_jobs(jobs, max_created=max_n)
    ended_at = datetime.now(UTC)
    out: dict[str, Any] = {
        "status": "completed",
        "listing_source": "adzuna",
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }
    out.update(stats)
    log.info(
        "ingest_adzuna_jobs completed created=%s skipped=%s duration_ms=%s",
        out.get("created"),
        out.get("skipped"),
        out.get("ingest_duration_ms"),
    )
    return out


@celery_app.task(name="app.tasks.ingest_scrapling_jobs")
def ingest_scrapling_jobs() -> dict[str, Any]:
    """Scrapling/Greenhouse/JSON-LD ingest → ``CanonicalJobIn`` + persist."""
    started_at = datetime.now(UTC)
    max_n = max(1, settings.scrapling_ingest_max_jobs)
    jobs, err = fetch_scrapling_canonical(max_n)
    if err == "scrapling_disabled":
        ended_at = datetime.now(UTC)
        return {
            "status": "skipped_disabled",
            "detail": "Set SCRAPLING_ENABLED=true to enable Scrapling ingest.",
            "listing_source": "scrapling",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }
    if err:
        ended_at = datetime.now(UTC)
        log.warning("ingest_scrapling_jobs fetch_failed error=%s", err)
        return {
            "status": "fetch_failed",
            "error": err,
            "listing_source": "scrapling",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    stats = persist_canonical_jobs(jobs, max_created=max_n)
    ended_at = datetime.now(UTC)
    out: dict[str, Any] = {
        "status": "completed",
        "listing_source": "scrapling",
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }
    out.update(stats)
    log.info(
        "ingest_scrapling_jobs completed created=%s skipped=%s duration_ms=%s",
        out.get("created"),
        out.get("skipped"),
        out.get("ingest_duration_ms"),
    )
    return out


@celery_app.task(name="app.tasks.ingest_jsearch_jobs")
def ingest_jsearch_jobs(query_override: str | None = None) -> dict[str, Any]:
    """JSearch (RapidAPI) multi-board ingest → ``listing_source=jsearch``."""
    started_at = datetime.now(UTC)
    max_n = max(1, settings.jsearch_ingest_max_jobs)
    jobs, err = fetch_jsearch_canonical(max_n, query_override=query_override)
    if err == "missing_jsearch_credentials":
        ended_at = datetime.now(UTC)
        log.info("ingest_jsearch_jobs skipped_no_credentials")
        return {
            "status": "skipped_no_credentials",
            "detail": "Set DOUBOW_JSEARCH_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY (RapidAPI JSearch).",
            "listing_source": "jsearch",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }
    if err:
        ended_at = datetime.now(UTC)
        log.warning("ingest_jsearch_jobs fetch_failed error=%s", err)
        return {
            "status": "fetch_failed",
            "error": err,
            "listing_source": "jsearch",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    stats = persist_canonical_jobs(jobs, max_created=max_n)
    ended_at = datetime.now(UTC)
    out: dict[str, Any] = {
        "status": "completed",
        "listing_source": "jsearch",
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }
    out.update(stats)
    log.info(
        "ingest_jsearch_jobs completed created=%s skipped=%s duration_ms=%s",
        out.get("created"),
        out.get("skipped"),
        out.get("ingest_duration_ms"),
    )
    return out


@celery_app.task(name="app.tasks.ingest_active_jobs_db")
def ingest_active_jobs_db(
    title_filter_override: str | None = None,
    location_filter_override: str | None = None,
) -> dict[str, Any]:
    """Active Jobs DB (RapidAPI) ingest → ``listing_source=active_jobs_db``."""
    started_at = datetime.now(UTC)
    max_n = max(1, settings.active_jobs_db_ingest_max_jobs)
    jobs, err = fetch_active_jobs_db_canonical(
        max_n,
        title_filter_override=title_filter_override,
        location_filter_override=location_filter_override,
    )
    if err == "missing_active_jobs_db_credentials":
        ended_at = datetime.now(UTC)
        log.info("ingest_active_jobs_db skipped_no_credentials")
        return {
            "status": "skipped_no_credentials",
            "detail": "Set DOUBOW_ACTIVE_JOBS_DB_RAPIDAPI_KEY or DOUBOW_RAPIDAPI_KEY / DOUBOW_JSEARCH_RAPIDAPI_KEY.",
            "listing_source": "active_jobs_db",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }
    if err:
        ended_at = datetime.now(UTC)
        log.warning("ingest_active_jobs_db fetch_failed error=%s", err)
        return {
            "status": "fetch_failed",
            "error": err,
            "listing_source": "active_jobs_db",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    stats = persist_canonical_jobs(jobs, max_created=max_n)
    ended_at = datetime.now(UTC)
    out: dict[str, Any] = {
        "status": "completed",
        "listing_source": "active_jobs_db",
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }
    out.update(stats)
    log.info(
        "ingest_active_jobs_db completed created=%s skipped=%s duration_ms=%s",
        out.get("created"),
        out.get("skipped"),
        out.get("ingest_duration_ms"),
    )
    return out


@celery_app.task(name="app.tasks.ingest_serpapi_google_jobs")
def ingest_serpapi_google_jobs(query_override: str | None = None) -> dict[str, Any]:
    """SerpAPI ``engine=google_jobs`` ingest → ``listing_source=serpapi_google_jobs``."""
    started_at = datetime.now(UTC)
    max_n = max(1, settings.serpapi_ingest_max_jobs)
    jobs, err = fetch_serpapi_google_jobs_canonical(max_n, query_override=query_override)
    if err == "missing_serpapi_credentials":
        ended_at = datetime.now(UTC)
        log.info("ingest_serpapi_google_jobs skipped_no_credentials")
        return {
            "status": "skipped_no_credentials",
            "detail": "Set DOUBOW_SERPAPI_API_KEY (SerpAPI Google Jobs).",
            "listing_source": "serpapi_google_jobs",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }
    if err:
        ended_at = datetime.now(UTC)
        log.warning("ingest_serpapi_google_jobs fetch_failed error=%s", err)
        return {
            "status": "fetch_failed",
            "error": err,
            "listing_source": "serpapi_google_jobs",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    stats = persist_canonical_jobs(jobs, max_created=max_n)
    ended_at = datetime.now(UTC)
    out: dict[str, Any] = {
        "status": "completed",
        "listing_source": "serpapi_google_jobs",
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }
    out.update(stats)
    log.info(
        "ingest_serpapi_google_jobs completed created=%s skipped=%s duration_ms=%s",
        out.get("created"),
        out.get("skipped"),
        out.get("ingest_duration_ms"),
    )
    return out


@celery_app.task(name="app.tasks.ingest_job_board_rss_batch")
def ingest_job_board_rss_batch() -> dict[str, Any]:
    """Enqueue ``scrape_rss_feed`` for each URL in ``DOUBOW_JOB_BOARD_RSS_URLS`` (public feeds only)."""
    started_at = datetime.now(UTC)
    urls = split_job_board_rss_urls(settings.job_board_rss_urls)
    if not urls:
        ended_at = datetime.now(UTC)
        return {
            "status": "skipped_no_urls",
            "detail": "Set DOUBOW_JOB_BOARD_RSS_URLS (comma/newline/pipe-separated RSS/Atom URLs).",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    n = 0
    for u in urls:
        scrape_rss_feed.delay(u)
        n += 1
    ended_at = datetime.now(UTC)
    return {
        "status": "queued_children",
        "feeds": len(urls),
        "queued_tasks": n,
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }


def _catalog_company_names(limit: int) -> list[str]:
    with SessionLocal() as db:
        rows = db.execute(
            select(Job.company)
            .where(Job.company.is_not(None))
            .group_by(Job.company)
            .order_by(func.count(Job.id).desc(), Job.company.asc())
            .limit(max(1, min(limit, 500)))
        ).all()
    out: list[str] = []
    seen: set[str] = set()
    for (company,) in rows:
        if not isinstance(company, str):
            continue
        key = normalize_company_key(company)
        if key and key not in seen:
            out.append(company.strip())
            seen.add(key)
    return out


def _upsert_glassdoor_company_enrichment(company_name: str, payload: Any) -> str:
    now = datetime.now(UTC)
    normalized = normalize_company_key(company_name)
    if not normalized:
        return "skipped_invalid_company"
    summary = glassdoor_company_summary(company_name, payload)

    with SessionLocal() as db:
        existing = db.scalar(
            select(CompanyEnrichment).where(
                CompanyEnrichment.provider == "glassdoor_realtime",
                CompanyEnrichment.normalized_company == normalized,
            )
        )
        if existing is None:
            existing = CompanyEnrichment(
                provider="glassdoor_realtime",
                normalized_company=normalized,
                company_name=summary["company_name"],
                source="companies",
                payload={},
                created_at=now,
            )
            db.add(existing)

        existing.company_name = summary["company_name"]
        existing.provider_ref = summary.get("provider_ref")
        existing.website_url = summary.get("website_url")
        existing.logo_url = summary.get("logo_url")
        existing.rating = summary.get("rating")
        existing.review_count = summary.get("review_count")
        existing.interview_count = summary.get("interview_count")
        existing.payload = payload if isinstance(payload, dict) else {"data": payload}
        existing.fetched_at = now
        existing.updated_at = now
        db.commit()
    return "upserted"


def _upsert_glassdoor_interview_company_enrichment(interview_id: str, payload: Any) -> str:
    summary = glassdoor_interview_company_summary(interview_id, payload)
    company_name = summary["company_name"]
    normalized = normalize_company_key(company_name)
    if not normalized:
        return "skipped_invalid_company"

    now = datetime.now(UTC)
    with SessionLocal() as db:
        existing = db.scalar(
            select(CompanyEnrichment).where(
                CompanyEnrichment.provider == "glassdoor_realtime",
                CompanyEnrichment.normalized_company == normalized,
            )
        )
        if existing is None:
            existing = CompanyEnrichment(
                provider="glassdoor_realtime",
                normalized_company=normalized,
                company_name=company_name,
                source="interview_details",
                payload={},
                created_at=now,
            )
            db.add(existing)

        existing.company_name = company_name
        existing.provider_ref = summary.get("provider_ref")
        existing.website_url = summary.get("website_url")
        existing.logo_url = summary.get("logo_url")
        existing.rating = summary.get("rating")
        existing.review_count = summary.get("review_count")
        existing.interview_count = summary.get("interview_count")
        existing.source = "interview_details"
        existing.payload = payload if isinstance(payload, dict) else {"data": payload}
        existing.fetched_at = now
        existing.updated_at = now
        db.commit()
    return "upserted"


@celery_app.task(name="app.tasks.ingest_glassdoor_company_context")
def ingest_glassdoor_company_context(
    companies: list[str] | None = None,
    limit: int = 50,
) -> dict[str, Any]:
    """Glassdoor Real-time company search → persisted employer enrichment snapshots."""
    started_at = datetime.now(UTC)
    names = [c.strip() for c in (companies or []) if isinstance(c, str) and c.strip()]
    if not names:
        names = _catalog_company_names(limit)
    if not names:
        ended_at = datetime.now(UTC)
        return {
            "status": "skipped_no_companies",
            "listing_source": "glassdoor_realtime",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    cap = max(1, min(limit, 500))
    created_or_updated = 0
    failed = 0
    skipped = 0
    errors: dict[str, str] = {}

    for company_name in names[:cap]:
        data, err = fetch_glassdoor_realtime_resource(
            "companies",
            {"query": company_name, "q": company_name, "company": company_name},
        )
        if err == "missing_glassdoor_realtime_credentials":
            ended_at = datetime.now(UTC)
            return {
                "status": "skipped_no_credentials",
                "detail": (
                    "Set DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY or "
                    "DOUBOW_RAPIDAPI_KEY / DOUBOW_JSEARCH_RAPIDAPI_KEY."
                ),
                "listing_source": "glassdoor_realtime",
                **_ingest_meta(started_at=started_at, ended_at=ended_at),
            }
        if err or data is None:
            failed += 1
            errors[company_name[:120]] = str(err or "empty_response")[:300]
            continue
        status = _upsert_glassdoor_company_enrichment(company_name, data)
        if status == "upserted":
            created_or_updated += 1
        else:
            skipped += 1

    ended_at = datetime.now(UTC)
    return {
        "status": "completed",
        "listing_source": "glassdoor_realtime",
        "companies_requested": len(names[:cap]),
        "upserted": created_or_updated,
        "failed": failed,
        "skipped": skipped,
        "errors": errors,
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }


@celery_app.task(name="app.tasks.ingest_glassdoor_interview_details")
def ingest_glassdoor_interview_details(interview_ids: list[str]) -> dict[str, Any]:
    """Glassdoor Real-time interview-details → persisted employer enrichment snapshots."""
    started_at = datetime.now(UTC)
    ids: list[str] = []
    for raw in interview_ids or []:
        s = str(raw).strip()
        if s.isdigit() and s not in ids:
            ids.append(s[:24])

    if not ids:
        ended_at = datetime.now(UTC)
        return {
            "status": "skipped_no_interview_ids",
            "listing_source": "glassdoor_realtime",
            **_ingest_meta(started_at=started_at, ended_at=ended_at),
        }

    upserted = 0
    failed = 0
    errors: dict[str, str] = {}
    for interview_id in ids[:200]:
        data, err = fetch_company_interview_details(interview_id)
        if err == "missing_glassdoor_realtime_credentials":
            ended_at = datetime.now(UTC)
            return {
                "status": "skipped_no_credentials",
                "detail": (
                    "Set DOUBOW_GLASSDOOR_REALTIME_RAPIDAPI_KEY or "
                    "DOUBOW_RAPIDAPI_KEY / DOUBOW_JSEARCH_RAPIDAPI_KEY."
                ),
                "listing_source": "glassdoor_realtime",
                **_ingest_meta(started_at=started_at, ended_at=ended_at),
            }
        if err or data is None:
            failed += 1
            errors[interview_id] = str(err or "empty_response")[:300]
            continue
        status = _upsert_glassdoor_interview_company_enrichment(interview_id, data)
        if status == "upserted":
            upserted += 1
        else:
            failed += 1
            errors[interview_id] = status

    ended_at = datetime.now(UTC)
    return {
        "status": "completed",
        "listing_source": "glassdoor_realtime",
        "interview_ids_requested": len(ids[:200]),
        "upserted": upserted,
        "failed": failed,
        "errors": errors,
        **_ingest_meta(started_at=started_at, ended_at=ended_at),
    }


@celery_app.task(name="app.tasks.score_job")
def score_job(job_id: str) -> dict[str, Any]:
    """
    Refresh match embeddings for a job (same pipeline as ``embed_job``).

    The personalized feed uses cosine similarity against ``Job.embedding_vector``; this task
    re-computes that vector for backfills, rescrapes, or operator re-drive on the ``score`` queue.
    """
    base = _embed_job_sync(job_id)
    status = base.get("status")
    ready = status == "embedded"
    return {**base, "match_embedding_ready": ready}


@celery_app.task(name="app.tasks.generate_outreach_draft")
def generate_outreach_draft(application_id: str) -> dict[str, Any]:
    """Enqueue-able regeneration of email + LinkedIn drafts (writes ``llm_logs`` rows)."""
    with SessionLocal() as db:
        try:
            aid = UUID(application_id)
        except Exception:
            return {"application_id": application_id, "status": "invalid_id"}
        app_obj = db.get(Application, aid)
        if app_obj is None:
            return {"application_id": application_id, "status": "missing"}
        content, meta_e = generate_email_draft_content(db, app_obj)
        li, meta_l = generate_linkedin_draft_content(db, app_obj)
        d1 = OutreachDraft(
            application_id=app_obj.id, channel="email", content=content, status=DraftStatus.DRAFT
        )
        d2 = OutreachDraft(
            application_id=app_obj.id,
            channel="linkedin",
            content=li,
            status=DraftStatus.DRAFT,
        )
        db.add(d1)
        db.add(d2)
        db.commit()
        db.refresh(d1)
        db.refresh(d2)
        return {
            "application_id": application_id,
            "status": "ok",
            "email_draft_id": str(d1.id),
            "linkedin_draft_id": str(d2.id),
            "meta": {"email": meta_e, "linkedin": meta_l},
        }


@celery_app.task(name="app.tasks.send_notification")
def send_notification(user_id: str, message: str) -> dict[str, Any]:
    """Legacy audit hook (optional). Prefer ``dispatch_application_outbound`` for outreach sends."""
    with SessionLocal() as db:
        try:
            uid = UUID(user_id)
        except Exception:
            return {"user_id": user_id, "status": "invalid_id"}
        record_llm_interaction(
            db,
            user_id=uid,
            agent_name="sender_notification",
            prompt_parts=(message, "legacy_stub"),
            raw_output=json.dumps({"message": message, "sent": False, "channel": "stub"}),
            latency_ms=0,
        )
        db.commit()
    return {"user_id": user_id, "sent": False, "message": message, "status": "logged"}


def _smtp_send_text(*, to_addr: str, subject: str, body: str) -> None:
    """Send plain-text mail via SMTP.

    Amazon SES: use regional ``email-smtp.<region>.amazonaws.com``.
    """
    import smtplib
    from email.message import EmailMessage

    if not (settings.smtp_host and settings.smtp_from):
        raise RuntimeError("smtp_not_configured")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from
    msg["To"] = to_addr
    msg.set_content(body, subtype="plain", charset="utf-8")
    payload = msg.as_string()

    if settings.smtp_use_ssl:
        with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(settings.smtp_from, [to_addr], payload)
        return

    # Port 587 / STARTTLS (SES and most providers expect EHLO before and after TLS).
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as smtp:
        smtp.ehlo()
        if settings.smtp_use_tls:
            smtp.starttls()
            smtp.ehlo()
        if settings.smtp_user and settings.smtp_password:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.sendmail(settings.smtp_from, [to_addr], payload)


def _transactional_from_header() -> str:
    """From: line for Resend (and consistency checks). ``resend_from`` overrides ``smtp_from``."""
    raw = (settings.resend_from or settings.smtp_from or "").strip()
    if not raw:
        raise RuntimeError("mail_from_missing")
    return raw


def _email_transport_configured() -> bool:
    """True when we can send transactional plain text (Resend API or SMTP)."""
    if (settings.resend_api_key or "").strip():
        try:
            _transactional_from_header()
            return True
        except RuntimeError:
            return False
    return bool(settings.smtp_host and settings.smtp_from)


def _resend_send_plain(*, to_addr: str, subject: str, body: str) -> None:
    """Send plain-text mail via Resend HTTP API (https://api.resend.com/emails)."""
    key = (settings.resend_api_key or "").strip()
    if not key:
        raise RuntimeError("resend_not_configured")
    from_header = _transactional_from_header()
    r = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        json={
            "from": from_header,
            "to": [to_addr],
            "subject": subject,
            "text": body,
        },
        timeout=30.0,
    )
    if r.status_code >= 400:
        raise RuntimeError(f"resend_http_{r.status_code}: {(r.text or '')[:800]}")


def _send_transactional_plain_email(*, to_addr: str, subject: str, body: str) -> None:
    """Resend wins when ``DOUBOW_RESEND_API_KEY`` is set; otherwise SMTP."""
    if (settings.resend_api_key or "").strip():
        _resend_send_plain(to_addr=to_addr, subject=subject, body=body)
        return
    _smtp_send_text(to_addr=to_addr, subject=subject, body=body)


def send_signup_welcome_email_sync(to_email: str) -> None:
    """
    Best-effort welcome after ``POST /auth/signup``.

    Delivered **to** the user's mailbox (e.g. Gmail) **from** your verified Resend/SMTP domain — not
    sent through their Google account. Intended for FastAPI ``BackgroundTasks`` so signup stays fast.
    """
    to_email = (to_email or "").strip()
    if not to_email:
        return
    if not _email_transport_configured():
        log.debug("welcome_email_skipped no_email_transport to=%s", to_email)
        return
    origins = settings.cors_allow_origins_list
    base = (origins[0] if origins else "http://localhost:3000").rstrip("/")
    dashboard_url = f"{base}/app/dashboard"
    body = (
        "Welcome to Doubow,\n\n"
        f"Your account is ready. Sign in with {to_email} and open your workspace:\n"
        f"{dashboard_url}\n\n"
        "Upload a résumé, explore matched roles, and move applications through your pipeline — with "
        "explicit approval before anything is sent on your behalf.\n\n"
        "— The Doubow team\n"
    )
    subject = "Welcome to Doubow"
    try:
        _send_transactional_plain_email(to_addr=to_email, subject=subject, body=body)
    except Exception as e:
        log.warning("welcome_email_failed to=%s err=%s", to_email, e)


def _send_resume_upload_acknowledgement_email(*, db: Session, doc: ResumeDocument) -> None:
    """
    Acknowledgement of receipt to the account email after parse (and optional embed) succeeds.

    Best-effort only: skips when mail is not configured; logs and swallows send errors so the
    pipeline result is never lost because of SMTP/Resend.
    """
    if not _email_transport_configured():
        log.debug("resume_upload_ack skipped: no email transport")
        return
    user = db.get(User, doc.user_id)
    if user is None or not str(user.email).strip():
        log.debug("resume_upload_ack skipped: missing user email doc_id=%s", doc.id)
        return

    origins = settings.cors_allow_origins_list
    base = (origins[0] if origins else "http://localhost:3000").rstrip("/")
    dashboard_url = f"{base}/app/dashboard"

    if doc.status == ResumeStatus.EMBEDDED:
        detail = "\nYour résumé text is indexed for discovery and fit scoring.\n"
    elif doc.status == ResumeStatus.PARSED and doc.error:
        detail = (
            "\nNote: text extraction succeeded, but embedding did not complete "
            f"({doc.error}). Discovery may be limited until this is resolved.\n"
        )
    elif doc.status == ResumeStatus.PARSED:
        detail = "\nYour résumé text was extracted successfully.\n"
    else:
        detail = ""

    body = (
        "Hello,\n\n"
        "This message acknowledges receipt of your résumé upload in Doubow.\n\n"
        f"File: {doc.file_name}\n"
        f"Processing status: {doc.status}\n"
        f"{detail}\n"
        f"Open your workspace: {dashboard_url}\n\n"
        "— Doubow\n"
    )
    subject = "[Doubow] Acknowledgement of receipt — résumé received"
    try:
        _send_transactional_plain_email(to_addr=str(user.email).strip(), subject=subject, body=body)
    except Exception as e:
        log.warning("resume_upload_ack_email_failed doc_id=%s err=%s", doc.id, e)


@celery_app.task(name="app.tasks.send_followup_reminder_emails")
def send_followup_reminder_emails() -> dict[str, Any]:
    """
    Email users about application follow-ups due within the next ~30 minutes (or overdue).

    Requires Resend (``DOUBOW_RESEND_API_KEY`` + from address) or SMTP. At most one email per
    scheduled ``next_followup_at`` instant per application, tracked via ``followup_notified_for_at``.
    """
    if not _email_transport_configured():
        log.debug("followup_reminders skipped: no email transport (Resend or SMTP)")
        return {"status": "skipped", "reason": "no_email_transport", "batches": 0, "applications": 0}

    now = datetime.now(UTC)
    window_end = now + timedelta(minutes=30)

    origins = settings.cors_allow_origins_list
    base_url = (origins[0] if origins else "http://localhost:3000").rstrip("/")
    tracker_url = f"{base_url}/app/tracker"

    with SessionLocal() as db:
        stmt = (
            select(Application, User.email)
            .join(User, User.id == Application.user_id)
            .where(Application.next_followup_at.is_not(None))
            .where(Application.next_followup_at <= window_end)
            .where(
                or_(
                    Application.followup_notified_for_at.is_(None),
                    Application.followup_notified_for_at != Application.next_followup_at,
                )
            )
        )
        rows = db.execute(stmt).all()
        if not rows:
            return {"status": "ok", "batches": 0, "applications": 0}

        by_user: defaultdict[UUID, list[Application]] = defaultdict(list)
        emails: dict[UUID, str] = {}
        for row in rows:
            app = row[0]
            email = row[1]
            by_user[app.user_id].append(app)
            emails[app.user_id] = email

        batches = 0
        for uid, apps in by_user.items():
            user_email = emails[uid]
            lines = [
                "You have follow-up reminders in Doubow:",
                "",
            ]
            for a in apps:
                when = a.next_followup_at
                when_s = (
                    when.astimezone(UTC).strftime("%Y-%m-%d %H:%M UTC")
                    if when is not None
                    else "(time unset)"
                )
                lines.append(f"- {a.company} · {a.job_title} (due {when_s})")
                if a.source_url:
                    lines.append(f"  Listing: {a.source_url}")
            lines.extend(["", f"Open tracker: {tracker_url}", "", "— Doubow (automated reminder)"])
            body = "\n".join(lines)
            subject = f"[Doubow] Follow-up: {len(apps)} role(s)"
            try:
                _send_transactional_plain_email(to_addr=user_email, subject=subject, body=body)
            except Exception as e:
                log.warning("followup_reminder_email_failed user=%s err=%s", uid, e)
                continue
            batches += 1
            for a in apps:
                a.followup_notified_for_at = a.next_followup_at
            db.commit()

        return {"status": "ok", "batches": batches, "applications": len(rows)}


def _mark_drafts_failed(db: Session, application_id: UUID) -> None:
    drafts = db.scalars(
        select(OutreachDraft).where(
            OutreachDraft.application_id == application_id,
            OutreachDraft.status == DraftStatus.DRAFT,
            OutreachDraft.channel != "follow_up",
        )
    ).all()
    for d in drafts:
        d.status = DraftStatus.FAILED
    db.commit()


@celery_app.task(
    bind=True,
    name="app.tasks.dispatch_application_outbound",
    max_retries=3,
)
def dispatch_application_outbound(self, application_id: str) -> dict[str, Any]:
    """
    Sender agent: runs after submit (SUBMITTED). Requires human APPROVAL via state machine
    before submit enqueues this task. Dispatches email (Resend or SMTP) and LinkedIn (optional webhook),
    with exponential backoff retries (max 3) on recoverable failures.

    Resend / SMTP and webhooks run outside a DB session so connections are not held across slow I/O.
    """
    try:
        aid = UUID(application_id)
    except Exception:
        return {"application_id": application_id, "status": "invalid_id"}

    try:
        # --- Load plan (short DB session; no network I/O) ---
        with SessionLocal() as db:
            app = db.get(Application, aid)
            if app is None:
                return {"application_id": application_id, "status": "missing"}
            if app.status != ApplicationStatus.SUBMITTED:
                return {
                    "application_id": application_id,
                    "status": "skipped_not_submitted",
                    "detail": (
                        "Sender only runs for SUBMITTED applications (after APPROVED submit)."
                    ),
                }

            user = db.get(User, app.user_id)
            if user is None:
                return {"application_id": application_id, "status": "missing_user"}

            drafts = db.scalars(
                select(OutreachDraft)
                .where(
                    OutreachDraft.application_id == aid,
                    OutreachDraft.status == DraftStatus.DRAFT,
                )
                .order_by(OutreachDraft.created_at.asc())
            ).all()

            subject = f"Outreach draft — {app.company} ({app.job_title})"
            user_id = user.id
            user_email = user.email

            steps: list[tuple[str, UUID, str | None, str]] = []
            for d in drafts:
                if d.channel == "follow_up":
                    continue
                if d.channel == "email":
                    steps.append(("email", d.id, subject, d.content))
                elif d.channel == "linkedin":
                    steps.append(("linkedin", d.id, None, d.content))
                else:
                    steps.append(("unknown", d.id, d.channel, ""))

        results: list[dict[str, Any]] = []

        def _persist_email_success(draft_id: UUID, subj: str, ms: int) -> None:
            with SessionLocal() as db:
                row = db.get(OutreachDraft, draft_id)
                if row is None or row.status != DraftStatus.DRAFT:
                    return
                record_llm_interaction(
                    db,
                    user_id=user_id,
                    agent_name="sender_email",
                    prompt_parts=(str(aid), str(draft_id), subj),
                    raw_output=json.dumps({"channel": "email", "to": user_email, "sent": True}),
                    latency_ms=ms,
                )
                row.status = DraftStatus.SENT
                db.commit()

        def _persist_email_no_transport(draft_id: UUID) -> None:
            with SessionLocal() as db:
                row = db.get(OutreachDraft, draft_id)
                if row is None:
                    return
                record_llm_interaction(
                    db,
                    user_id=user_id,
                    agent_name="sender_email",
                    prompt_parts=(str(aid), str(draft_id), "no_email_transport"),
                    raw_output=json.dumps({"channel": "email", "to": user_email, "sent": False}),
                    latency_ms=0,
                )
                db.commit()

        def _persist_li_success(draft_id: UUID, status_code: int, ms: int) -> None:
            with SessionLocal() as db:
                row = db.get(OutreachDraft, draft_id)
                if row is None or row.status != DraftStatus.DRAFT:
                    return
                record_llm_interaction(
                    db,
                    user_id=user_id,
                    agent_name="sender_linkedin",
                    prompt_parts=(str(aid), str(draft_id), "webhook"),
                    raw_output=json.dumps({"sent": True, "status_code": status_code}),
                    latency_ms=ms,
                )
                row.status = DraftStatus.SENT
                db.commit()

        def _persist_li_no_webhook(draft_id: UUID) -> None:
            with SessionLocal() as db:
                row = db.get(OutreachDraft, draft_id)
                if row is None:
                    return
                record_llm_interaction(
                    db,
                    user_id=user_id,
                    agent_name="sender_linkedin",
                    prompt_parts=(str(aid), str(draft_id), "no_webhook"),
                    raw_output=json.dumps({"sent": False, "note": "configure_webhook"}),
                    latency_ms=0,
                )
                db.commit()

        for kind, draft_id, meta, body in steps:
            if kind == "unknown":
                ch = meta or "?"
                results.append({"channel": ch, "sent": False, "reason": "unknown_channel"})
                continue

            if kind == "email":
                subj = meta or subject
                if _email_transport_configured():
                    t0 = time.perf_counter()
                    _send_transactional_plain_email(to_addr=user_email, subject=subj, body=body)
                    ms = int((time.perf_counter() - t0) * 1000)
                    _persist_email_success(draft_id, subj, ms)
                    results.append({"channel": "email", "sent": True})
                else:
                    _persist_email_no_transport(draft_id)
                    results.append({"channel": "email", "sent": False, "reason": "no_email_transport"})
                continue

            # linkedin
            payload = {
                "application_id": str(aid),
                "draft_id": str(draft_id),
                "user_id": str(user_id),
                "content": body,
            }
            if settings.linkedin_dispatch_webhook_url:
                t0 = time.perf_counter()
                r = httpx.post(
                    settings.linkedin_dispatch_webhook_url,
                    json=payload,
                    timeout=30.0,
                )
                r.raise_for_status()
                ms = int((time.perf_counter() - t0) * 1000)
                _persist_li_success(draft_id, r.status_code, ms)
                results.append({"channel": "linkedin", "sent": True})
            else:
                _persist_li_no_webhook(draft_id)
                results.append({"channel": "linkedin", "sent": False, "reason": "no_webhook"})

        return {"application_id": application_id, "status": "ok", "results": results}
    except Exception as exc:  # noqa: BLE001
        log.warning("dispatch_application_outbound attempt failed: %s", exc)
        if self.request.retries >= self.max_retries:
            with SessionLocal() as db:
                _mark_drafts_failed(db, aid)
            raise
        raise self.retry(exc=exc, countdown=min(300, 10 * (2 ** self.request.retries))) from exc


def run_process_resume_document_sync(resume_document_id: str) -> dict[str, Any]:
    """
    Parse PDF/DOCX from S3, optional LLM structure, optional OpenAI embedding → ``EMBEDDED``.

    Used by POST ``/me/resume`` (BackgroundTasks) by default and by the Celery task when enabled.
    """
    with SessionLocal() as db:
        try:
            doc_id = UUID(resume_document_id)
        except Exception:
            return {"id": resume_document_id, "status": "invalid_id"}

        doc = db.execute(
            select(ResumeDocument).where(ResumeDocument.id == doc_id)
        ).scalar_one_or_none()
        if doc is None:
            return {"id": resume_document_id, "status": "missing"}

        try:
            client = s3_client()
            obj = client.get_object(Bucket=doc.s3_bucket, Key=doc.s3_key)
            data: bytes = obj["Body"].read()

            ct = (doc.content_type or "").lower()
            if ct == "application/pdf" or doc.file_name.lower().endswith(".pdf"):
                extracted = parse_pdf_bytes(data)
            elif (
                ct == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                or doc.file_name.lower().endswith(".docx")
            ):
                extracted = parse_docx_bytes(data)
            else:
                raise ResumeParseError("Unsupported resume file type")

            doc.extracted_text = extracted
            structured = structure_resume_text(extracted)
            llm_structured: dict[str, object] | None = None
            if settings.resume_llm_structuring_enabled:
                llm_structured = _run_llm_resume_structure(extracted)
            doc.parsed_json = {
                "text": extracted,
                "length": len(extracted),
                "structured": structured,
                "structured_llm": llm_structured,
            }
            doc.status = ResumeStatus.PARSED
            doc.error = None

            if settings.openai_api_key:
                try:
                    vec = embed_resume_text(extracted)
                    doc.embedding = vec
                    doc.embedding_vector = vec
                    doc.embedding_model = settings.openai_embedding_model
                    doc.status = ResumeStatus.EMBEDDED
                except EmbeddingError as emb_err:
                    doc.error = str(emb_err)

            db.add(doc)
            db.commit()
            _send_resume_upload_acknowledgement_email(db=db, doc=doc)
            return {"id": str(doc.id), "status": doc.status, "chars": len(extracted)}
        except (ResumeParseError, Exception) as e:
            doc.status = ResumeStatus.FAILED
            doc.error = repr(e)
            db.add(doc)
            db.commit()
            raise


@celery_app.task(name="app.tasks.process_resume_document")
def process_resume_document(resume_document_id: str) -> dict[str, Any]:
    """
    Celery entrypoint — same work as :func:`run_process_resume_document_sync`.

    Enable with ``DOUBOW_RESUME_PROCESS_VIA_CELERY=true`` on upload if you prefer workers only.
    """
    return run_process_resume_document_sync(resume_document_id)


@celery_app.task(name="app.tasks.mark_stale_jobs")
def mark_stale_jobs() -> dict[str, Any]:
    """
    Mark jobs as stale based on the configured freshness window.

    This makes query-time freshness cheaper/consistent and supports future UX like "show stale".
    """
    cutoff = datetime.utcnow() - timedelta(days=max(1, settings.jobs_stale_after_days))
    now = datetime.now(UTC)
    with SessionLocal() as db:
        res2 = db.execute(
            update(Job)
            .where(Job.is_stale.is_(False))
            .where(func.coalesce(Job.source_posted_at, Job.created_at) < cutoff)
            .values(is_stale=True, stale_at=now)
        )
        db.commit()
        return {
            "status": "completed",
            "marked_stale": int(res2.rowcount or 0),
            "cutoff": cutoff.isoformat(),
        }
