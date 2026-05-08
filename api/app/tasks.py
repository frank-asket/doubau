from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import redis
from celery.signals import task_failure

from app.celery_app import celery_app
from app.core.settings import settings


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
def _on_task_failure(sender=None, task_id=None, exception=None, args=None, kwargs=None, traceback=None, einfo=None, **_):
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

