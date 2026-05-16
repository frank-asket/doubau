"""Optional hooks that run when the API process starts."""

from __future__ import annotations

import logging

from app.core.settings import settings

log = logging.getLogger(__name__)

_BOOTSTRAP_LOCK_KEY = "doubow:bootstrap_ingest_lock_v1"
_BOOTSTRAP_LOCK_TTL_S = 900


def run_startup_bootstrap_ingest() -> None:
    """Queue initial catalog ingest once per deploy window (multi-instance safe via Redis NX).

    Mirrors ``POST /jobs/cron/queue-ingest``: RapidAPI JSearch and Active Jobs DB,
    plus Glassdoor employer enrichment.

    Requires Redis, a Celery worker consuming the ``scrape`` queue, and ``DOUBOW_OPENAI_API_KEY``
    for ``embed_job`` to populate vectors after rows are inserted.
    """
    if not settings.bootstrap_ingest_on_startup:
        return

    try:
        import redis

        r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        if not r.set(_BOOTSTRAP_LOCK_KEY, "1", nx=True, ex=_BOOTSTRAP_LOCK_TTL_S):
            log.info("bootstrap ingest skipped (another replica holds the lock)")
            return
    except Exception as exc:
        log.warning("bootstrap ingest skipped (redis lock failed): %s", exc)
        return

    try:
        from app.tasks import (
            ingest_active_jobs_db,
            ingest_glassdoor_company_context,
            ingest_jsearch_jobs,
        )

        js = ingest_jsearch_jobs.delay()
        aj = ingest_active_jobs_db.delay()
        gd = ingest_glassdoor_company_context.delay(None, 50)
        log.info(
            "bootstrap ingest queued jsearch_task_id=%s active_jobs_db_task_id=%s "
            "glassdoor_company_context_task_id=%s",
            js.id,
            aj.id,
            gd.id,
        )
    except Exception as exc:
        log.warning("bootstrap ingest queue failed (is the broker up?): %s", exc)
