"""Per-user Google OAuth for Gmail in-app send."""

from __future__ import annotations

import time
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select

from app.api.deps import CurrentUserDep, DbDep
from app.core.settings import settings
from app.integrations.gmail_oauth import (
    build_authorization_url,
    encrypt_refresh_token,
    exchange_code_for_tokens,
    fetch_google_account_email,
    fetch_google_user_profile,
    google_oauth_configured,
    send_plaintext_email,
)
from app.models.profile import Profile
from app.models.user_google_token import UserGoogleToken
from app.services.profile_identity_sync import merge_profile_goals

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
    google_display_name: str | None = None
    google_picture_url: str | None = None


class GoogleSendTestEmailIn(BaseModel):
    """Send a single plaintext test via the connected account (Gmail API ``gmail.send``)."""

    to: EmailStr
    subject: str | None = Field(default=None, max_length=220)
    body: str | None = Field(
        default=None,
        max_length=8000,
        description="Optional body; default explains this is a DouBow connectivity test.",
    )


class GoogleSendTestEmailOut(BaseModel):
    ok: bool = True
    from_addr: str
    to: str
    gmail_message_id: str | None = None


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


def _google_profile_from_goals(profile: Profile | None) -> tuple[str | None, str | None]:
    if profile is None or not isinstance(profile.goals, dict):
        return None, None
    gp = profile.goals.get("google_profile")
    if not isinstance(gp, dict):
        return None, None
    name = gp.get("name")
    pic = gp.get("picture")
    n_out = name.strip() if isinstance(name, str) and name.strip() else None
    p_out = pic.strip() if isinstance(pic, str) and pic.strip() else None
    return n_out, p_out


@router.get("/status", response_model=GoogleStatusOut)
def google_status(db: DbDep, current_user: CurrentUserDep) -> GoogleStatusOut:
    row = db.get(UserGoogleToken, current_user.id)
    prof = db.scalar(select(Profile).where(Profile.user_id == current_user.id))
    disp, pic = _google_profile_from_goals(prof)
    return GoogleStatusOut(
        oauth_configured=google_oauth_configured(),
        connected=row is not None,
        google_account_email=row.google_account_email if row else None,
        google_display_name=disp,
        google_picture_url=pic,
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
        g_prof = fetch_google_user_profile(access.strip())
        if g_prof:
            merge_profile_goals(
                db,
                user_id=current_user.id,
                patch={
                    "google_profile": {
                        **g_prof,
                        "synced_at": datetime.now(UTC).isoformat(),
                    },
                },
            )
            prof = db.scalar(select(Profile).where(Profile.user_id == current_user.id))
            if prof is not None and isinstance(prof.goals, dict):
                g = dict(prof.goals)
                gp = g.get("google_profile")
                if isinstance(gp, dict):
                    n = gp.get("name")
                    hl = g.get("headline")
                    has_hl = isinstance(hl, str) and bool(hl.strip())
                    if isinstance(n, str) and n.strip() and not has_hl:
                        g["headline"] = n.strip()
                        prof.goals = g

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
    prof = db.scalar(select(Profile).where(Profile.user_id == current_user.id))
    disp, pic_url = _google_profile_from_goals(prof)
    return GoogleStatusOut(
        oauth_configured=True,
        connected=row is not None,
        google_account_email=row.google_account_email if row else None,
        google_display_name=disp,
        google_picture_url=pic_url,
    )


@router.post("/send-test-email", response_model=GoogleSendTestEmailOut)
def google_send_test_email(
    payload: GoogleSendTestEmailIn,
    db: DbDep,
    current_user: CurrentUserDep,
) -> GoogleSendTestEmailOut:
    """Send a minimal test message through Gmail API (same stack as in-app application send).

    Requires Google OAuth configured on the API and a completed Gmail connect flow for this user.
    Use to verify ``gmail.send`` end-to-end (e.g. to ``asketsystem1@gmail.com``).
    """
    if not google_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail="Gmail OAuth is not configured on the server (set DOUBOW_GOOGLE_OAUTH_*).",
        )
    g = db.get(UserGoogleToken, current_user.id)
    if g is None or not g.refresh_ciphertext:
        raise HTTPException(
            status_code=400,
            detail="Connect Gmail under Settings before sending a test message.",
        )
    from_addr = (g.google_account_email or "").strip()
    if not from_addr:
        raise HTTPException(
            status_code=400,
            detail="Reconnect Gmail — we could not read your Google account email.",
        )
    to_addr = str(payload.to).strip()
    subj = (payload.subject or "").strip() or "DouBow — Gmail send test"
    body = (payload.body or "").strip() or (
        "This is an automated connectivity test from DouBow.\n\n"
        "If you received this, Gmail API send (gmail.send) is working for your connected account.\n"
    )
    bcc_addrs: tuple[str, ...] = ()
    if from_addr.lower() != to_addr.lower():
        bcc_addrs = (from_addr,)
    try:
        sent_resp = send_plaintext_email(
            refresh_token_cipher=g.refresh_ciphertext,
            from_addr=from_addr,
            to_addr=to_addr,
            subject=subj,
            body=body,
            bcc_addrs=bcc_addrs or None,
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Gmail send failed: {e!s}") from e

    gmail_mid: str | None = None
    if isinstance(sent_resp, dict):
        mid_raw = sent_resp.get("id")
        if isinstance(mid_raw, str) and mid_raw.strip():
            gmail_mid = mid_raw.strip()[:255]
    return GoogleSendTestEmailOut(from_addr=from_addr, to=to_addr, gmail_message_id=gmail_mid)


@router.delete("/disconnect", response_model=GoogleStatusOut)
def google_disconnect(db: DbDep, current_user: CurrentUserDep) -> GoogleStatusOut:
    row = db.get(UserGoogleToken, current_user.id)
    if row is not None:
        db.delete(row)
        db.commit()
    prof = db.scalar(select(Profile).where(Profile.user_id == current_user.id))
    disp, pic_url = _google_profile_from_goals(prof)
    return GoogleStatusOut(
        oauth_configured=google_oauth_configured(),
        connected=False,
        google_account_email=None,
        google_display_name=disp,
        google_picture_url=pic_url,
    )
