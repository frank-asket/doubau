#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Phase 3 Gate (Phase 3 agents + llm_logs; expects Compose stack + migrations) =="
docker compose ps --status running postgres redis api worker >/dev/null 2>&1 || {
  echo "Run scripts/phase1_gate.sh first or: docker compose up -d postgres redis minio api worker"
  exit 1
}

echo "Applying migrations..."
docker compose exec -T api alembic upgrade head

echo "Running Phase 3 API tests..."
docker compose exec -T api pytest -q tests/test_phase3_outreach.py

echo "Phase 3 Gate PASSED."
