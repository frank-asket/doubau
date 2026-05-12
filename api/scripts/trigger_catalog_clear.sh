#!/usr/bin/env sh
# Delete ingested catalog jobs (default: provider sources only) and Redis fingerprint keys, then you can queue-ingest again.
# Same auth as queue-ingest: DOUBOW_CRON_INGEST_SECRET + X-Doubow-Cron-Secret.
#
#   export DOUBOW_API_BASE_URL=https://your-api.example.com
#   export DOUBOW_CRON_INGEST_SECRET='...'
#   sh api/scripts/trigger_catalog_clear.sh
#
# Optional: clear every job row (including manual):
#   MODE=all sh api/scripts/trigger_catalog_clear.sh

set -eu

if [ -z "${DOUBOW_API_BASE_URL:-}" ] || [ -z "${DOUBOW_CRON_INGEST_SECRET:-}" ]; then
  echo "Set DOUBOW_API_BASE_URL and DOUBOW_CRON_INGEST_SECRET (same as API DOUBOW_CRON_INGEST_SECRET)." >&2
  exit 1
fi

MODE="${MODE:-providers}"
BASE="${DOUBOW_API_BASE_URL%/}"
code=$(curl -sS -o /tmp/doubow-cron-clear.json -w "%{http_code}" -X POST "${BASE}/jobs/cron/clear-catalog?mode=${MODE}" \
  -H "X-Doubow-Cron-Secret: ${DOUBOW_CRON_INGEST_SECRET}" \
  -H "Accept: application/json")

cat /tmp/doubow-cron-clear.json
echo ""
echo "HTTP ${code}" >&2
test "${code}" = "200"
