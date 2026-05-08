from __future__ import annotations

import json
import re
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlparse
from uuid import UUID

import httpx
import redis
from celery.signals import task_failure
from sqlalchemy import select

from app.celery_app import celery_app
from app.core.settings import settings
from app.db import SessionLocal
from app.jobs.html_snippet import extract_title_from_html
from app.jobs.rss_links import extract_feed_entry_links
from app.jobs.url_hash import hash_source_url
from app.models.job import Job
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.resume.embeddings import EmbeddingError, embed_resume_text
from app.resume.parser import ResumeParseError, parse_docx_bytes, parse_pdf_bytes
from app.resume.structure import structure_resume_text
from app.storage.s3 import ensure_bucket, s3_client


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


@celery_app.task(name="app.tasks.embed_job")
def embed_job(job_id: str) -> dict[str, Any]:
    """Embed job title+company+description with OpenAI; fill ``embedding_vector``."""
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
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        jid = str(job.id)

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


@celery_app.task(name="app.tasks.score_job")
def score_job(job_id: str) -> dict[str, Any]:
    return {"job_id": job_id, "score": 0.0, "status": "stub"}


@celery_app.task(name="app.tasks.generate_outreach_draft")
def generate_outreach_draft(application_id: str) -> dict[str, Any]:
    return {"application_id": application_id, "status": "stub"}


@celery_app.task(name="app.tasks.send_notification")
def send_notification(user_id: str, message: str) -> dict[str, Any]:
    return {"user_id": user_id, "sent": False, "message": message, "status": "stub"}


@celery_app.task(name="app.tasks.process_resume_document")
def process_resume_document(resume_document_id: str) -> dict[str, Any]:
    """
    Phase 1 pipeline:
    - download raw file from S3
    - parse PDF/DOCX -> extracted_text + parsed_json
    - OpenAI embedding -> JSONB + pgvector column (status EMBEDDED) when API key is set
    - persist back to `resume_documents`
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
            doc.parsed_json = {
                "text": extracted,
                "length": len(extracted),
                "structured": structured,
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
            return {"id": str(doc.id), "status": doc.status, "chars": len(extracted)}
        except (ResumeParseError, Exception) as e:
            doc.status = ResumeStatus.FAILED
            doc.error = repr(e)
            db.add(doc)
            db.commit()
            raise

