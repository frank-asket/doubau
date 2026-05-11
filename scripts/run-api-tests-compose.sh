#!/usr/bin/env sh
set -eu
# Run API tests against Docker Compose Postgres + Redis (avoids host :5432 conflicts).
# Usage: from repo root — bash scripts/run-api-tests-compose.sh

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Starting postgres + redis (if needed)..."
docker compose up -d postgres redis

echo "Running migrations + pytest (api source mounted from host)..."
docker compose run --rm -v "${ROOT}/api:/app" api sh -c "alembic upgrade head && python -m pytest tests/ -q --tb=line"
