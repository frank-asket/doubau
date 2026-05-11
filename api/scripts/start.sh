#!/usr/bin/env sh
set -eu

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting API..."
# Railway injects PORT (often 8080). Docker Compose local API defaults to 8000 when unset.
PORT="${PORT:-8000}"
echo "Listening on port ${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

