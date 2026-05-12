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

## 3. Frontend (Next.js)

1. **Vercel env vars** (see `web/.env.example`):
   - **`NEXT_PUBLIC_API_BASE_URL`** — public Railway API URL, **HTTPS**, **no trailing slash**.
   - **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** / **`CLERK_SECRET_KEY`** — production Clerk keys.
2. Clerk dashboard: allowed origins / redirect URLs for your Vercel domain(s).
3. Build: `cd web && npm ci && npm run typecheck && npm run build`.

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
