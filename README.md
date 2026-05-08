# Doubow

AI-assisted job search workspace with strict human-in-the-loop approval for all outbound actions.

## Local development

### Prereqs
- Docker Desktop

### Run everything

```bash
docker compose up --build
```

- Web: `http://localhost:3000`
- API health: `http://localhost:8000/health`

## Services
- `web/`: Next.js (marketing + app)
- `api/`: FastAPI (auth, state machine, workers later)

