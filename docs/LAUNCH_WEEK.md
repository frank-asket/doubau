# Launch week runbook (Doubow)

Use this as the minimum path to ship **web (Vercel)** + **API (Railway or Docker)** + **workers** + **data stores** in one week.

## 1. Prerequisites

| Layer | Requirement |
|--------|-------------|
| **Database** | Postgres with **pgvector** (same major as prod migrations). Run **`alembic upgrade head`** before traffic. |
| **Redis** | Required for Celery, idempotency, fingerprints. |
| **Object storage** | S3 (or compatible). Résumés + optional job HTML; bucket + IAM match `DOUBOW_S3_*`. |
| **Auth** | **Clerk** production instance + **JWT template** for FastAPI (`doubow-api` or `CLERK_JWT_TEMPLATE`). |
| **Secrets** | Strong **`DOUBOW_JWT_SECRET`** (even when using Clerk for users — legacy/local tokens). |

## 2. Backend (FastAPI)

1. Set **`DOUBOW_ENVIRONMENT=production`** (or staging).
2. **`DOUBOW_CORS_ALLOW_ORIGINS`**: include exact Vercel origins (`https://your-app.vercel.app`, custom domain). JSON array or comma-separated — see `api/.env.example`.
3. **`DOUBOW_CLERK_*`** JWKS / issuer / audience aligned with Clerk JWT template.
4. **`DOUBOW_DATABASE_URL`** or platform **`DATABASE_URL`**.
5. **`DOUBOW_REDIS_URL`** or **`REDIS_URL`** for workers.
6. **`DOUBOW_OPENAI_API_KEY`** for embeddings, fit scores, JD-fit, outreach, interview prep (or accept degraded modes where implemented).
7. Deploy **API** + **Celery worker** + **Celery beat** (scheduled ingest). Compose reference: `docker-compose.yml` (`worker`, `beat` services).

Optional checks:

```bash
cd api && python scripts/check_launch_env.py
```

For a production pre-flight, export the real service env first. The API check exits nonzero when
`DOUBOW_ENVIRONMENT=production` is still using local database/S3/CORS values, default JWT secrets,
or Clerk development issuer/JWKS.

### Job catalog ingest (automated)

Discovery stays empty until rows exist in Postgres. Automate ingest with **any** of these (combine as needed):

1. **Celery Beat + worker** (recommended baseline): same env as the API, Redis broker, worker listening on `default,scrape,score,draft,notify`, Beat process running. Optional env **`DOUBOW_INGEST_BEAT_HOURLY_REMOTEOK=true`** adds hourly Remote OK at **:17 UTC** in addition to the daily schedule in `api/app/celery_app.py`.
2. **Cron HTTP hook**: set **`DOUBOW_CRON_INGEST_SECRET`** on the API (long random string). **`POST /jobs/cron/queue-ingest`** with header **`X-Doubow-Cron-Secret`** queues Remote OK + Adzuna (+ Scrapling when `SCRAPLING_ENABLED=true`). Returns **404** if the secret is unset (endpoint hidden). To wipe ingested rows before a fresh pull, **`POST /jobs/cron/clear-catalog?mode=providers`** (same header; optional **`mode=all`** deletes every job including manual).
3. **GitHub Actions**: workflow **`.github/workflows/catalog-ingest.yml`** — add repo secrets **`DOUBOW_API_BASE_URL`** and **`DOUBOW_CRON_INGEST_SECRET`** matching the API. Runs every 6 hours and on manual dispatch; skips quietly until secrets exist.
4. **Bootstrap on API startup** (optional): **`DOUBOW_BOOTSTRAP_INGEST_ON_STARTUP=true`** queues Remote OK + Adzuna ingest **once** after deploy (Redis NX lock so multiple replicas do not duplicate). Still requires a **worker** to drain the queue.

**One Railway service (smallest footprint):** In the API service env set **`DOUBOW_START_WORKER_IN_API=true`** and **`DOUBOW_START_BEAT_IN_API=true`** so `api/scripts/start.sh` runs Celery worker + beat beside Uvicorn. Set **`DOUBOW_OPENAI_API_KEY`** on the same service so **`embed_job`** can write **`embedding_vector`**. Combine with **`DOUBOW_BOOTSTRAP_INGEST_ON_STARTUP=true`** for an immediate first ingest after deploy, or rely on beat/cron only.

**Multiple Railway services** (recommended at scale): same Docker image — service A: API (`scripts/start.sh` without inline worker/beat); service B: `celery worker -Q default,scrape,score,draft,notify`; service C: `celery beat`.

Manual smoke after setting **`DOUBOW_CRON_INGEST_SECRET`** on Railway:

```bash
curl -sS -X POST "${DOUBOW_API_BASE_URL}/jobs/cron/queue-ingest" \
  -H "X-Doubow-Cron-Secret: ${DOUBOW_CRON_INGEST_SECRET}"
```

Or from the repo: `sh api/scripts/trigger_catalog_ingest.sh` (same two env vars).

## 3. Frontend (Next.js)

1. **Vercel env vars** (see `web/.env.example`):
   - **`NEXT_PUBLIC_API_BASE_URL`** — public Railway API URL, **HTTPS**, **no trailing slash**.
   - **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** / **`CLERK_SECRET_KEY`** — production Clerk keys.
   - **`CLERK_JWT_TEMPLATE`** — optional; defaults to `doubow-api`.
2. Clerk dashboard: allowed origins / redirect URLs for your Vercel domain(s).
3. Pre-flight: `cd web && npm run launch:check`.
4. Build (matches CI order): `cd web && npm ci && npm run test && npm run typecheck && npm run build`.

GitHub Actions **CI** (`.github/workflows/ci.yml`) runs `npm run test` and `npm run typecheck` on every push/PR to `main`/`master` before the Next.js production build.

Vercel **Production** builds validate env: **`NEXT_PUBLIC_API_BASE_URL`** must be HTTPS (not
localhost). Clerk keys must be a **matching pair** — `pk_test_` with `sk_test_` (demo on
`*.vercel.app`) or `pk_live_` with `sk_live_` (custom domain).

## 4. Smoke tests (same day as deploy)

1. Open **`/api/health`** on the Next deployment — expect JSON with `next` and `api_reachable` / `api_body`.
2. Sign in → **`/app/demo-milestone`** — walk checklist with real résumé + one role + approvals path.
3. **`/app/notifications`** → click through to Tracker (**`?highlight=`**) and Discovery (**job id**).

## 5. Operational checklist

- [ ] Error monitoring (e.g. Sentry) on web + API — optional but recommended week 1.
- [ ] Backup strategy for Postgres (provider snapshots).
- [ ] Rate limits / abuse: Clerk + API hosting defaults; tighten later.
- [ ] Legal: privacy policy + terms links from marketing pages if public launch.

## 6. Rollback

- Vercel: redeploy previous deployment.
- Railway: roll back to previous deployment or image tag.
- Database: restore snapshot if migration failed — avoid destructive migrations without backup.
