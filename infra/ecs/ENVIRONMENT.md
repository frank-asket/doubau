# Environment variables checklist

## API (`doubow-api`)
- `DOUBOW_DATABASE_URL` (RDS Postgres connection string)
- `DOUBOW_JWT_SECRET` (Secrets Manager)
- `DOUBOW_CORS_ALLOW_ORIGINS` (web origin list)
- `DOUBOW_ENVIRONMENT` (`prod`/`staging`)

## Web (`doubow-web`)
- `NEXT_PUBLIC_API_BASE_URL` (public URL for API, e.g. `https://api.doubow.com`)

