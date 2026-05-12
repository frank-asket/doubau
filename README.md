# Doubow

AI-assisted job search workspace with strict human-in-the-loop approval for all outbound actions.

**MVP Definition of Done vs this repo:** see [`docs/mvp-definition-of-done.md`](docs/mvp-definition-of-done.md) for an honest feature-by-feature alignment (including Stripe, ATS Optimizer, WCAG, load tests, and GDPR gaps).

## Local development

### Prereqs
- Docker Desktop

### Run everything

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API health: `http://localhost:8000/health`

### API tests (PostgreSQL)

Integration-style tests under `api/tests/` expect Postgres (same as `docker compose`). Use **Python 3.12 or 3.13** for the API venv: LangChain’s pinned stack is not compatible with **Python 3.14** yet.

```bash
cd api
UV_PYTHON=python3.13 uv sync
uv run pytest tests/test_job_get_api.py tests/test_milestones_api.py -q
```

`api/pyproject.toml` now lists dependencies so `uv sync` matches the app; `requirements.txt` remains a convenient flat list for non-uv workflows.

**Same tests as CI, locally with Compose DB/Redis:** `bash scripts/run-api-tests-compose.sh` (needs Docker; mounts `api/` into the `api` image so you run the code on your branch).

### Railway (production API)

- Public API: **`https://doubau-production.up.railway.app`** — **HTTP target / container port `8080`**, matching Railway’s default **`PORT=8080`** and **`scripts/start.sh`** (`uvicorn --port "$PORT"`; local Docker still defaults to **8000** when `PORT` is unset).
- If the dashboard **target port** were **8000** while the app listens on **8080**, you would see **502** from the edge even when deploy logs show Uvicorn started.
- **Postgres / Redis**: use each plugin’s **private** URL in **`DOUBOW_DATABASE_URL`** and **`DOUBOW_REDIS_URL`** on the API service only.

## Services
- `web/`: Next.js (marketing + app)
- `api/`: FastAPI (auth, state machine, workers later)

## Production launch (this week)
- **Runbook:** [`docs/LAUNCH_WEEK.md`](docs/LAUNCH_WEEK.md) — CORS, Clerk, workers, smoke tests.
- **Web env template:** `web/.env.example`
- **Pre-flight (web):** `cd web && npm run launch:check` (after exporting Vercel env)
- **Pre-flight (API):** `python api/scripts/check_launch_env.py` (after exporting Railway/API env)
- **CI:** GitHub Actions workflow `.github/workflows/ci.yml` (typecheck + Next build + API compile)
- **Catalog ingest:** [`docs/LAUNCH_WEEK.md`](docs/LAUNCH_WEEK.md) — Celery worker + beat; optional `POST /jobs/cron/queue-ingest` + [`.github/workflows/catalog-ingest.yml`](.github/workflows/catalog-ingest.yml)
