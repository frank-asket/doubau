#!/usr/bin/env python3
"""Validate launch-critical API env vars before production deploy."""

from __future__ import annotations

import os
from pathlib import Path
import sys


def load_dotenv_if_present() -> None:
    """Minimal .env loader for local pre-flight checks; real platform env wins."""
    path = Path(".env")
    if not path.exists():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def main() -> None:
    load_dotenv_if_present()

    warnings: list[str] = []
    blockers: list[str] = []
    env = os.environ
    environment = (env.get("DOUBOW_ENVIRONMENT") or "").strip().lower()
    strict = environment == "production" or (env.get("DOUBOW_LAUNCH_STRICT") or "").lower() in {
        "1",
        "true",
        "yes",
    }

    def issue(message: str, *, production_blocker: bool = True) -> None:
        if strict and production_blocker:
            blockers.append(message)
        else:
            warnings.append(message)

    db = (env.get("DOUBOW_DATABASE_URL") or env.get("DATABASE_URL") or "").strip()
    if not db:
        issue("No DOUBOW_DATABASE_URL or DATABASE_URL — database required.")
    elif strict and any(x in db for x in ("localhost", "127.0.0.1", "postgres:postgres@")):
        blockers.append("Database URL looks local/dev. Use the production private Postgres URL.")

    redis_url = (env.get("DOUBOW_REDIS_URL") or env.get("REDIS_URL") or "").strip()
    if not redis_url:
        issue("No DOUBOW_REDIS_URL or REDIS_URL — Celery / Redis features need Redis.")
    elif strict and any(x in redis_url for x in ("localhost", "127.0.0.1", "redis:6379")):
        warnings.append("Redis URL looks local/dev. Confirm this is correct for the API runtime.")

    if not (env.get("DOUBOW_OPENAI_API_KEY") or env.get("OPENAI_API_KEY") or "").strip():
        warnings.append(
            "No DOUBOW_OPENAI_API_KEY / OPENAI_API_KEY — embeddings, fit scores, JD-fit, outreach, interview prep may fail or use fallbacks."
        )

    cors = (env.get("DOUBOW_CORS_ALLOW_ORIGINS") or "").strip()
    if not cors:
        issue("DOUBOW_CORS_ALLOW_ORIGINS is empty — set exact web origin(s).")
    elif strict and ("localhost" in cors or "127.0.0.1" in cors):
        blockers.append(
            "DOUBOW_CORS_ALLOW_ORIGINS includes localhost in strict/production mode. Use exact HTTPS production origin(s)."
        )

    clerk_ok = (
        (env.get("DOUBOW_CLERK_JWKS_URL") or "").strip()
        and (env.get("DOUBOW_CLERK_ISSUER") or "").strip()
        and (env.get("DOUBOW_CLERK_AUDIENCE") or "").strip()
    )
    clerk_jwks_url = (env.get("DOUBOW_CLERK_JWKS_URL") or "").strip()
    clerk_issuer = (env.get("DOUBOW_CLERK_ISSUER") or "").strip()
    if not clerk_ok:
        issue(
            "Clerk JWT verification not fully configured (DOUBOW_CLERK_JWKS_URL / ISSUER / AUDIENCE). "
            "Required for signed-in API calls from the Next app."
        )
    elif strict and (".clerk.accounts.dev" in clerk_issuer or ".clerk.accounts.dev" in clerk_jwks_url):
        blockers.append("Clerk issuer/JWKS uses a development Clerk domain. Use a Clerk Production instance.")

    jwt_secret = (env.get("DOUBOW_JWT_SECRET") or "").strip()
    if jwt_secret in {"", "dev_only_change_me"}:
        issue("DOUBOW_JWT_SECRET is default or empty — set a strong secret for production.")
    elif strict and len(jwt_secret) < 32:
        warnings.append("DOUBOW_JWT_SECRET is short. Use at least 32 random characters.")

    s3_endpoint = (env.get("DOUBOW_S3_ENDPOINT_URL") or "").strip()
    if strict and s3_endpoint and ("localhost" in s3_endpoint or "minio" in s3_endpoint):
        blockers.append("DOUBOW_S3_ENDPOINT_URL looks local/MinIO. Omit it for AWS S3 production.")

    print("Doubow API launch env check\n", file=sys.stderr)
    if not blockers and not warnings:
        print("No launch env warnings detected (still verify workers and smoke tests manually).\n")
        return

    if blockers:
        print(f"{len(blockers)} blocker(s):\n", file=sys.stderr)
        for b in blockers:
            print(f"  - {b}", file=sys.stderr)
        print("", file=sys.stderr)
    if warnings:
        print(f"{len(warnings)} warning(s):\n", file=sys.stderr)
    for w in warnings:
        print(f"  - {w}", file=sys.stderr)
    if blockers:
        print("\nFix blockers above before public launch.\n", file=sys.stderr)
    else:
        print("\nReview warnings above before public launch.\n", file=sys.stderr)
    if blockers:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
