#!/usr/bin/env sh
# Queue RapidAPI JSearch + Active Jobs DB ingest on a deployed API.
# API must have DOUBOW_CRON_INGEST_SECRET set; send the same value in X-Doubow-Cron-Secret.
#
#   export DOUBOW_API_BASE_URL=https://your-api.example.com
#   export DOUBOW_CRON_INGEST_SECRET='...'
#   sh api/scripts/trigger_catalog_ingest.sh

set -eu

if [ -z "${DOUBOW_API_BASE_URL:-}" ] || [ -z "${DOUBOW_CRON_INGEST_SECRET:-}" ]; then
  echo "Set DOUBOW_API_BASE_URL and DOUBOW_CRON_INGEST_SECRET (same as API DOUBOW_CRON_INGEST_SECRET)." >&2
  exit 1
fi

BASE="${DOUBOW_API_BASE_URL%/}"
code=$(curl -sS -o /tmp/doubow-cron-ingest.json -w "%{http_code}" -X POST "${BASE}/jobs/cron/queue-ingest" \
  -H "X-Doubow-Cron-Secret: ${DOUBOW_CRON_INGEST_SECRET}" \
  -H "Accept: application/json")

cat /tmp/doubow-cron-ingest.json
echo ""
echo "HTTP ${code}" >&2
test "${code}" = "200"
