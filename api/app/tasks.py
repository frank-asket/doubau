from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import redis
from celery.signals import task_failure
from sqlalchemy import select

from app.celery_app import celery_app
from app.core.settings import settings
from app.db import SessionLocal
from app.models.resume_document import ResumeDocument, ResumeStatus
from app.resume.embeddings import EmbeddingError, embed_resume_text
from app.resume.parser import ResumeParseError, parse_docx_bytes, parse_pdf_bytes
from app.resume.structure import structure_resume_text
from app.storage.s3 import s3_client


def _dlq_client() -> redis.Redis:
    return redis.Redis.from_url(settings.redis_url, decode_responses=True)


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


# Queue placeholders for Phase 1 wiring.
@celery_app.task(name="app.tasks.scrape_job")
def scrape_job(job_id: str) -> dict[str, Any]:
    return {"job_id": job_id, "status": "stub"}


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

