#!/usr/bin/env python3
"""Warn about missing env vars before production launch. Exit 0 always — human-readable only."""

from __future__ import annotations

import os
import sys


def main() -> None:
    warnings: list[str] = []
    env = os.environ

    db = (env.get("DOUBOW_DATABASE_URL") or env.get("DATABASE_URL") or "").strip()
    if not db:
        warnings.append("No DOUBOW_DATABASE_URL or DATABASE_URL — database required.")

    redis_url = (env.get("DOUBOW_REDIS_URL") or env.get("REDIS_URL") or "").strip()
    if not redis_url:
        warnings.append("No DOUBOW_REDIS_URL or REDIS_URL — Celery / Redis features need Redis.")

    if not (env.get("DOUBOW_OPENAI_API_KEY") or env.get("OPENAI_API_KEY") or "").strip():
        warnings.append(
            "No DOUBOW_OPENAI_API_KEY / OPENAI_API_KEY — embeddings, fit scores, JD-fit, outreach, interview prep may fail or use fallbacks."
        )

    cors = (env.get("DOUBOW_CORS_ALLOW_ORIGINS") or "").strip()
    if "localhost" in cors and len(cors) < 25:
        warnings.append(
            "DOUBOW_CORS_ALLOW_ORIGINS looks local-only — add your production web origin(s) for browser API calls."
        )

    clerk_ok = (
        (env.get("DOUBOW_CLERK_JWKS_URL") or "").strip()
        and (env.get("DOUBOW_CLERK_ISSUER") or "").strip()
        and (env.get("DOUBOW_CLERK_AUDIENCE") or "").strip()
    )
    if not clerk_ok:
        warnings.append(
            "Clerk JWT verification not fully configured (DOUBOW_CLERK_JWKS_URL / ISSUER / AUDIENCE). "
            "Required for signed-in API calls from the Next app."
        )

    jwt_secret = (env.get("DOUBOW_JWT_SECRET") or "").strip()
    if jwt_secret in {"", "dev_only_change_me"}:
        warnings.append('DOUBOW_JWT_SECRET is default or empty — set a strong secret for production.')

    print("Doubow API launch env check\n", file=sys.stderr)
    if not warnings:
        print("No blocking warnings detected (still verify CORS, S3, and worker deploy manually).\n")
        return

    print(f"{len(warnings)} warning(s):\n", file=sys.stderr)
    for w in warnings:
        print(f"  - {w}", file=sys.stderr)
    print("\nFix warnings above before public launch.\n", file=sys.stderr)


if __name__ == "__main__":
    main()
