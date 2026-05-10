#!/usr/bin/env sh
set -eu

echo "Running Alembic migrations..."
alembic upgrade head

echo "Starting API..."
PORT="${PORT:-8000}"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"

