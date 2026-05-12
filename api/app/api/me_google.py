"""Per-user Google OAuth for Gmail in-app send."""

from __future__ import annotations

import time
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep, DbDep
from app.core.settings import settings
from app.integrations.gmail_oauth import (
    build_authorization_url,
    encrypt_refresh_token,
    exchange_code_for_tokens,
    fetch_google_account_email,
    google_oauth_configured,
)
from app.models.user_google_token import UserGoogleToken

router = APIRouter(prefix="/me/google", tags=["me-google"])

STATE_AUD = "doubow-google-oauth"


class GoogleOAuthUrlOut(BaseModel):
    authorization_url: str
    state: str


class GoogleOAuthCallbackIn(BaseModel):
    code: str = Field(min_length=10, max_length=2048)
    state: str = Field(min_length=10, max_length=2048)


class GoogleStatusOut(BaseModel):
    oauth_configured: bool
    connected: bool
    google_account_email: str | None = None


def _encode_oauth_state(user_id: str) -> str:
    exp = int(time.time()) + 900
    return jwt.encode(
        {"sub": user_id, "aud": STATE_AUD, "exp": exp},
        settings.jwt_secret,
        algorithm="HS256",
    )


def _decode_oauth_state(token: str, *, expected_sub: str) -> None:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=STATE_AUD,
        )
    except JWTError as e:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state") from e
    sub = payload.get("sub")
    if sub != expected_sub:
        raise HTTPException(status_code=400, detail="OAuth state mismatch")


@router.get("/status", response_model=GoogleStatusOut)
def google_status(db: DbDep, current_user: CurrentUserDep) -> GoogleStatusOut:
    row = db.get(UserGoogleToken, current_user.id)
    return GoogleStatusOut(
        oauth_configured=google_oauth_configured(),
        connected=row is not None,
        google_account_email=row.google_account_email if row else None,
    )


@router.get("/oauth-url", response_model=GoogleOAuthUrlOut)
def google_oauth_url(current_user: CurrentUserDep) -> GoogleOAuthUrlOut:
    if not google_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail OAuth is not configured on the server (set DOUBOW_GOOGLE_OAUTH_*).",
        )
    state = _encode_oauth_state(str(current_user.id))
    try:
        url = build_authorization_url(state=state)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return GoogleOAuthUrlOut(authorization_url=url, state=state)


@router.post("/oauth/callback", response_model=GoogleStatusOut)
def google_oauth_callback(
    payload: GoogleOAuthCallbackIn,
    db: DbDep,
    current_user: CurrentUserDep,
) -> GoogleStatusOut:
    if not google_oauth_configured():
        raise HTTPException(status_code=503, detail="Gmail OAuth is not configured on the server.")
    _decode_oauth_state(payload.state, expected_sub=str(current_user.id))
    try:
        tok = exchange_code_for_tokens(code=payload.code.strip())
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Google token exchange failed: {e!s}") from e

    refresh = tok.get("refresh_token")
    if not isinstance(refresh, str) or not refresh.strip():
        raise HTTPException(
            status_code=400,
            detail=(
                "No refresh_token. Revoke Doubow in Google Account permissions, then reconnect."
            ),
        )
    access = tok.get("access_token")
    g_email: str | None = None
    if isinstance(access, str) and access.strip():
        g_email = fetch_google_account_email(access.strip())

    cipher = encrypt_refresh_token(refresh.strip())
    existing = db.get(UserGoogleToken, current_user.id)
    if existing is None:
        row = UserGoogleToken(
            user_id=current_user.id,
            refresh_ciphertext=cipher,
            google_account_email=g_email,
        )
        db.add(row)
    else:
        existing.refresh_ciphertext = cipher
        existing.google_account_email = g_email or existing.google_account_email
        existing.updated_at = datetime.now(UTC)
    db.commit()
    row = db.get(UserGoogleToken, current_user.id)
    return GoogleStatusOut(
        oauth_configured=True,
        connected=row is not None,
        google_account_email=row.google_account_email if row else None,
    )


@router.delete("/disconnect", response_model=GoogleStatusOut)
def google_disconnect(db: DbDep, current_user: CurrentUserDep) -> GoogleStatusOut:
    row = db.get(UserGoogleToken, current_user.id)
    if row is not None:
        db.delete(row)
        db.commit()
    return GoogleStatusOut(
        oauth_configured=google_oauth_configured(),
        connected=False,
        google_account_email=None,
    )
