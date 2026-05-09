from __future__ import annotations

from celery import Celery
from celery.schedules import crontab
from kombu import Queue

from app.core.settings import settings


def make_celery() -> Celery:
    app = Celery(
        "doubow",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=["app.tasks"],
    )

    app.conf.update(
        task_default_exchange="doubow",
        task_default_exchange_type="direct",
        task_default_routing_key="default",
        task_default_queue="default",
        task_queues=(
            Queue("default", routing_key="default"),
            Queue("scrape", routing_key="scrape"),
            Queue("score", routing_key="score"),
            Queue("draft", routing_key="draft"),
            Queue("notify", routing_key="notify"),
        ),
        task_routes={
            "app.tasks.ingest_remoteok_jobs": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_adzuna_jobs": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.scrape_job": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.score_job": {"queue": "score", "routing_key": "score"},
            "app.tasks.generate_outreach_draft": {"queue": "draft", "routing_key": "draft"},
            "app.tasks.send_notification": {"queue": "notify", "routing_key": "notify"},
        },
        task_track_started=True,
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            # Daily provider ingest (Week 3 sprint). Requires running celery beat.
            "ingest-adzuna-0600-utc": {
                "task": "app.tasks.ingest_adzuna_jobs",
                "schedule": crontab(hour=6, minute=0),
            },
            "ingest-remoteok-0700-utc": {
                "task": "app.tasks.ingest_remoteok_jobs",
                "schedule": crontab(hour=7, minute=0),
            },
        },
    )
    return app


celery_app = make_celery()
celery_app.set_default()

