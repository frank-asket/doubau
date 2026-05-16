from __future__ import annotations

from celery import Celery
from celery.schedules import crontab
from kombu import Queue

from app.core.settings import settings


def make_celery() -> Celery:
    beat_schedule: dict = {
        # Daily provider ingest (Week 3 sprint). Requires running celery beat.
        "ingest-jsearch-0530-utc": {
            "task": "app.tasks.ingest_jsearch_jobs",
            "schedule": crontab(hour=5, minute=30),
        },
        "ingest-active-jobs-db-0545-utc": {
            "task": "app.tasks.ingest_active_jobs_db",
            "schedule": crontab(hour=5, minute=45),
        },
        "mark-stale-jobs-0800-utc": {
            "task": "app.tasks.mark_stale_jobs",
            "schedule": crontab(hour=8, minute=0),
        },
        "followup-reminders-quarter-hourly": {
            "task": "app.tasks.send_followup_reminder_emails",
            "schedule": crontab(minute="*/15"),
        },
    }
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
            "app.tasks.ingest_adzuna_jobs": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_scrapling_jobs": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_jsearch_jobs": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_active_jobs_db": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_serpapi_google_jobs": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_job_board_rss_batch": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_glassdoor_company_context": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.ingest_glassdoor_interview_details": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.scrape_job": {"queue": "scrape", "routing_key": "scrape"},
            "app.tasks.score_job": {"queue": "score", "routing_key": "score"},
            "app.tasks.generate_outreach_draft": {"queue": "draft", "routing_key": "draft"},
            "app.tasks.send_notification": {"queue": "notify", "routing_key": "notify"},
            "app.tasks.send_followup_reminder_emails": {"queue": "notify", "routing_key": "notify"},
            "app.tasks.dispatch_application_outbound": {"queue": "notify", "routing_key": "notify"},
        },
        task_track_started=True,
        worker_prefetch_multiplier=1,
        task_acks_late=True,
        timezone="UTC",
        enable_utc=True,
        beat_schedule=beat_schedule,
    )
    return app


celery_app = make_celery()
celery_app.set_default()
