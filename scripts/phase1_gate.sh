#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== Phase 1 Gate =="
echo "Bringing up services with fresh volumes..."
docker compose down -v --remove-orphans >/dev/null 2>&1 || true

for attempt in 1 2 3; do
  if docker compose up -d --build postgres redis minio api worker; then
    break
  fi
  echo "docker compose up failed (attempt $attempt). Retrying..."
  sleep 2
done

if ! docker compose ps --status running api | grep -q "Up"; then
  echo "Services failed to start."
  docker compose ps
  docker compose logs --no-color --tail=200 minio api worker || true
  exit 1
fi

echo "Waiting for API health..."
for i in {1..60}; do
  if curl -fsS "http://localhost:8000/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS "http://localhost:8000/health" >/dev/null
echo "API is healthy."

echo "Running API unit tests..."
docker compose exec -T api pytest -q

echo "Running Phase 1 smoke flow (auth + idempotency + HITL gate)..."
docker compose exec -T api python - <<'PY'
import uuid
import httpx

BASE = "http://localhost:8000"

email = f"phase1-{uuid.uuid4()}@example.com"
password = "correct-horse-battery"

with httpx.Client(timeout=10.0) as client:
    # signup => token
    r = client.post(f"{BASE}/auth/signup", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "content-type": "application/json"}

    # idempotency: same key + same body => same response
    idem_key = str(uuid.uuid4())
    body = {"company": "Acme", "job_title": "Product Manager"}
    r1 = client.post(f"{BASE}/applications", json=body, headers={**headers, "Idempotency-Key": idem_key})
    assert r1.status_code == 200, r1.text
    app1 = r1.json()

    r2 = client.post(f"{BASE}/applications", json=body, headers={**headers, "Idempotency-Key": idem_key})
    assert r2.status_code == 200, r2.text
    app2 = r2.json()
    assert app1["id"] == app2["id"], (app1, app2)

    app_id = app1["id"]

    # generate draft => pending approval
    rd = client.post(f"{BASE}/applications/{app_id}/generate_draft", headers=headers)
    assert rd.status_code == 200, rd.text

    # submit before approval => forbidden
    rs = client.post(f"{BASE}/applications/{app_id}/submit", headers=headers)
    assert rs.status_code == 403, rs.text

    # approve => approved
    ra = client.post(f"{BASE}/applications/{app_id}/approve", headers=headers)
    assert ra.status_code == 200, ra.text
    assert ra.json()["status"] == "APPROVED"

    # submit => submitted
    rs2 = client.post(f"{BASE}/applications/{app_id}/submit", headers=headers)
    assert rs2.status_code == 200, rs2.text
    assert rs2.json()["status"] == "SUBMITTED"

print("Phase 1 smoke flow: OK")
PY

echo "Running Celery smoke flow (queues + DLQ)..."
docker compose exec -T api python - <<'PY'
import time

from redis import Redis

from app.core.settings import settings
from app.tasks import fail_once, ping

r = Redis.from_url(settings.redis_url, decode_responses=True)
r.delete(settings.dlq_redis_key)

res = ping.apply_async(queue="default")
assert res.get(timeout=10) == "pong"

try:
    fail_once.apply_async(queue="default").get(timeout=10)
except Exception:
    pass

for _ in range(20):
    if r.llen(settings.dlq_redis_key) > 0:
        break
    time.sleep(0.25)

assert r.llen(settings.dlq_redis_key) > 0, "Expected at least one DLQ entry"
print("Celery smoke flow: OK")
PY

echo "Running Resume upload smoke flow (S3 + parse worker)..."
docker compose exec -T api python - <<'PY'
import time
import uuid
from io import BytesIO

import httpx
from docx import Document

BASE = "http://localhost:8000"

email = f"phase1-resume-{uuid.uuid4()}@example.com"
password = "correct-horse-battery"

buf = BytesIO()
doc = Document()
doc.add_heading("Franck Asket", level=1)
doc.add_paragraph("Experience: Built a FastAPI backend.")
doc.save(buf)
buf.seek(0)

with httpx.Client(timeout=20.0) as client:
    r = client.post(f"{BASE}/auth/signup", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("resume.docx", buf.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
    up = client.post(f"{BASE}/me/resume", headers=headers, files=files)
    assert up.status_code == 200, up.text
    rid = up.json()["id"]

    for _ in range(40):
        rr = client.get(f"{BASE}/me/resume/{rid}", headers=headers)
        assert rr.status_code == 200, rr.text
        status = rr.json()["status"]
        if status in ("PARSED", "EMBEDDED"):
            body = rr.json()
            assert "FastAPI backend" in (body.get("parsed_json") or {}).get("text", "")
            if status == "EMBEDDED":
                assert body.get("embedding_model"), body
            latest = client.get(f"{BASE}/me/resume/latest", headers=headers)
            assert latest.status_code == 200, latest.text
            assert latest.json().get("id") == rid
            break
        if status == "FAILED":
            raise AssertionError(rr.json())
        time.sleep(0.5)
    else:
        raise AssertionError("resume did not reach PARSED/EMBEDDED status in time")

print("Resume upload smoke flow: OK")
PY

echo "Phase 1 Gate PASSED."

