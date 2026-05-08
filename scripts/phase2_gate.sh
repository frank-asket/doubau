#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Phase 2 Gate (expects Phase 1 stack + migrations + optional OPENAI key) =="
docker compose ps --status running postgres redis api worker >/dev/null 2>&1 || {
  echo "Run scripts/phase1_gate.sh first or: docker compose up -d postgres redis minio api worker"
  exit 1
}

echo "Applying migrations..."
docker compose exec -T api alembic upgrade head

echo "Running API tests..."
docker compose exec -T api pytest -q tests/test_url_hash.py tests/test_jobs_scoring.py tests/test_resume_embeddings.py

echo "Smoke: job dedup + feed JSON..."
docker compose exec -T api python - <<'PY'
import uuid

import httpx

BASE = "http://localhost:8000"
email = f"phase2-{uuid.uuid4()}@example.com"
password = "correct-horse-battery"

with httpx.Client(timeout=15.0) as client:
    r = client.post(f"{BASE}/auth/signup", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    url = "https://example.com/job/phase2-test"
    body = {
        "company": "Acme",
        "title": "Engineer",
        "source_url": url,
        "description": "Build APIs.",
    }
    j1 = client.post(f"{BASE}/jobs", json=body, headers=headers)
    assert j1.status_code == 200, j1.text
    j2 = client.post(f"{BASE}/jobs", json=body, headers=headers)
    assert j2.status_code == 200, j2.text
    assert j1.json()["id"] == j2.json()["id"], "dedup failed"

    fd = client.get(f"{BASE}/jobs/feed", headers=headers)
    assert fd.status_code == 200, fd.text
    assert isinstance(fd.json(), list)

print("Phase 2 Gate PASSED.")
PY
