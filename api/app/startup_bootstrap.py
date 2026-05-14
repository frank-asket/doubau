"""Optional hooks that run when the API process starts."""

from __future__ import annotations

import logging

from app.core.settings import settings

log = logging.getLogger(__name__)

_BOOTSTRAP_LOCK_KEY = "doubow:bootstrap_ingest_lock_v1"
_BOOTSTRAP_LOCK_TTL_S = 900


def run_startup_bootstrap_ingest() -> None:
    """Queue initial catalog ingest once per deploy window (multi-instance safe via Redis NX).

    Mirrors ``POST /jobs/cron/queue-ingest``: RapidAPI JSearch + Active Jobs DB + SerpAPI first, then Remote OK,
    Adzuna, RSS batch, plus Scrapling when ``SCRAPLING_ENABLED`` is true.

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
            ingest_adzuna_jobs,
            ingest_job_board_rss_batch,
            ingest_jsearch_jobs,
            ingest_remoteok_jobs,
            ingest_scrapling_jobs,
            ingest_serpapi_google_jobs,
        )

        js = ingest_jsearch_jobs.delay()
        ajd = ingest_active_jobs_db.delay()
        sp = ingest_serpapi_google_jobs.delay()
        ro = ingest_remoteok_jobs.delay()
        ad = ingest_adzuna_jobs.delay()
        rss = ingest_job_board_rss_batch.delay()
        sc = ingest_scrapling_jobs.delay() if settings.scrapling_enabled else None
        log.info(
            "bootstrap ingest queued jsearch_task_id=%s active_jobs_db_task_id=%s serpapi_task_id=%s "
            "remoteok_task_id=%s adzuna_task_id=%s rss_batch_task_id=%s scrapling_task_id=%s",
            js.id,
            ajd.id,
            sp.id,
            ro.id,
            ad.id,
            rss.id,
            sc.id if sc else None,
        )
    except Exception as exc:
        log.warning("bootstrap ingest queue failed (is the broker up?): %s", exc)
