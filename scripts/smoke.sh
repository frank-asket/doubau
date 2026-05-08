#!/usr/bin/env bash
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"

echo "Checking API health..."
curl -fsS "$API_BASE_URL/health" >/dev/null

echo "Checking web homepage..."
curl -fsS "$WEB_BASE_URL/" >/dev/null

echo "Smoke checks passed."

