from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
from starlette.types import ASGIApp

from app.core.settings import settings
from app.db import SessionLocal
from app.models.idempotency_key import IdempotencyKey
from app.security import decode_access_token


class IdempotencyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return await call_next(request)

        key = request.headers.get("Idempotency-Key")
        if not key:
            return await call_next(request)

        # We scope idempotency to authenticated users only; this keeps semantics clear
        # (and avoids allowing anonymous clients to reserve keys indefinitely).
        auth = request.headers.get("Authorization") or ""
        if not auth.lower().startswith("bearer "):
            return await call_next(request)

        token = auth.split(" ", 1)[1].strip()
        try:
            payload = decode_access_token(token)
            sub = payload.get("sub")
            if not sub:
                return await call_next(request)
            user_id = UUID(sub)
        except Exception:  # noqa: BLE001
            return await call_next(request)

        # Read body once; we must re-inject it for downstream handlers.
        raw_body = await request.body()
        if len(raw_body) > settings.idempotency_max_body_bytes:
            return await call_next(request)

        body_sha = hashlib.sha256(raw_body).hexdigest() if raw_body else None

        async def receive():
            return {"type": "http.request", "body": raw_body, "more_body": False}

        request = Request(request.scope, receive)  # type: ignore[arg-type]

        now = datetime.now(UTC)
        expires_at = now + timedelta(hours=settings.idempotency_window_hours)

        with SessionLocal() as db:
            existing = (
                db.query(IdempotencyKey)
                .filter(
                    IdempotencyKey.user_id == user_id,
                    IdempotencyKey.key == key,
                    IdempotencyKey.expires_at > now,
                )
                .one_or_none()
            )
            if existing is not None:
                if existing.request_body_sha256 != body_sha:
                    return StarletteResponse(
                        content="Idempotency-Key reuse with different request body",
                        status_code=409,
                        media_type="text/plain",
                    )

                return StarletteResponse(
                    content=existing.response_body,
                    status_code=existing.response_status_code,
                    headers={k: str(v) for k, v in (existing.response_headers or {}).items()},
                    media_type=existing.response_media_type,
                )

        response: Response = await call_next(request)

        # Only cache small-ish, successful-ish responses.
        # (If the client wants retries for failures, they can just omit the key.)
        if response.status_code >= 500:
            return response

        # Consume the body iterator so we can persist and replay it.
        body_bytes = b""
        async for chunk in response.body_iterator:  # type: ignore[attr-defined]
            body_bytes += chunk
            if len(body_bytes) > settings.idempotency_max_response_bytes:
                return StarletteResponse(
                    content=body_bytes,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )

        body_text = body_bytes.decode("utf-8", errors="replace")
        headers = dict(response.headers)

        with SessionLocal() as db:
            record = IdempotencyKey(
                user_id=user_id,
                key=key,
                method=request.method,
                path=request.url.path,
                request_body_sha256=body_sha,
                response_status_code=response.status_code,
                response_media_type=response.media_type,
                response_headers=headers,
                response_body=body_text,
                expires_at=expires_at,
            )
            db.add(record)
            try:
                db.commit()
            except Exception:  # noqa: BLE001
                db.rollback()

        return StarletteResponse(
            content=body_bytes,
            status_code=response.status_code,
            headers=headers,
            media_type=response.media_type,
        )

