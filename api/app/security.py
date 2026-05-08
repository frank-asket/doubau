from __future__ import annotations

from datetime import UTC, datetime, timedelta
from time import time
from uuid import UUID

import httpx
from jose import jwk
from jose import jwt
from passlib.context import CryptContext

from app.core.settings import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_jwks_cache: dict[str, object] | None = None
_jwks_cache_ts: float = 0.0


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, user_id: UUID, email: str) -> str:
    now = datetime.now(UTC)
    exp = now + timedelta(minutes=settings.jwt_access_token_minutes)
    payload = {
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=["HS256"],
        issuer=settings.jwt_issuer,
        audience=settings.jwt_audience,
    )


async def _get_clerk_jwks() -> dict:
    global _jwks_cache, _jwks_cache_ts  # noqa: PLW0603
    if not settings.clerk_jwks_url:
        raise RuntimeError("Clerk JWKS URL not configured")

    now = time()
    if _jwks_cache is not None and (now - _jwks_cache_ts) < 300:
        return _jwks_cache  # type: ignore[return-value]

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(settings.clerk_jwks_url)
        resp.raise_for_status()
        data = resp.json()

    if not isinstance(data, dict) or "keys" not in data:
        raise RuntimeError("Invalid JWKS response")

    _jwks_cache = data
    _jwks_cache_ts = now
    return data


async def decode_clerk_token(token: str) -> dict:
    """
    Verify a Clerk-issued JWT using the configured JWKS.

    Clerk typically signs JWTs with RS256 and publishes public keys via JWKS.
    """
    if not (settings.clerk_jwks_url and settings.clerk_issuer and settings.clerk_audience):
        raise RuntimeError("Clerk JWT verification is not configured")

    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    if not kid:
        raise ValueError("Missing kid")

    jwks = await _get_clerk_jwks()
    keys = jwks.get("keys", [])
    if not isinstance(keys, list):
        raise RuntimeError("Invalid JWKS keys")

    key_data = next((k for k in keys if isinstance(k, dict) and k.get("kid") == kid), None)
    if key_data is None:
        # refresh once in case of key rotation
        global _jwks_cache, _jwks_cache_ts  # noqa: PLW0603
        _jwks_cache = None
        _jwks_cache_ts = 0.0
        jwks = await _get_clerk_jwks()
        keys = jwks.get("keys", [])
        key_data = next((k for k in keys if isinstance(k, dict) and k.get("kid") == kid), None)
        if key_data is None:
            raise ValueError("Unknown kid")

    public_key = jwk.construct(key_data)
    pem = public_key.to_pem()

    return jwt.decode(
        token,
        pem,
        algorithms=["RS256"],
        issuer=settings.clerk_issuer,
        audience=settings.clerk_audience,
    )


async def decode_any_access_token(token: str) -> dict:
    """
    Decode either a local Doubow HS256 token or a Clerk RS256 token.
    """
    try:
        return decode_access_token(token)
    except Exception:  # noqa: BLE001
        if settings.clerk_jwks_url:
            return await decode_clerk_token(token)
        raise

