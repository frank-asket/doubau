#!/usr/bin/env sh
set -eu

echo "Running Alembic migrations..."
alembic upgrade head

if [ "${DOUBOW_START_WORKER_IN_API:-false}" = "true" ]; then
  echo "Starting Celery worker alongside API..."
  celery -A app.celery_app.celery_app worker \
    -Q default,scrape,score,draft,notify \
    --concurrency="${DOUBOW_WORKER_CONCURRENCY:-2}" \
    --loglevel=info &
fi

echo "Starting API..."
# Railway injects PORT (often 8080). Docker Compose local API defaults to 8000 when unset.
PORT="${PORT:-8000}"
echo "Listening on port ${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
