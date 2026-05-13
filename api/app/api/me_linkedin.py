"""Per-user LinkedIn OAuth (OpenID Connect) to sync allowed profile fields into Doubow."""

from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.deps import CurrentUserDep, DbDep
from app.core.settings import settings
from app.integrations.linkedin_oauth import (
    access_expires_at_from_token_response,
    build_authorization_url,
    decrypt_token,
    encrypt_token,
    exchange_code_for_tokens,
    fetch_linkedin_userinfo,
    linkedin_oauth_configured,
    refresh_with_refresh_token,
)
from app.models.profile import Profile
from app.models.user_linkedin_token import UserLinkedInToken
from app.services.profile_identity_sync import clear_goal_keys, merge_profile_goals

router = APIRouter(prefix="/me/linkedin", tags=["me-linkedin"])

STATE_AUD = "doubow-linkedin-oauth"


class LinkedInOAuthUrlOut(BaseModel):
    authorization_url: str
    state: str


class LinkedInOAuthCallbackIn(BaseModel):
    code: str = Field(min_length=10, max_length=2048)
    state: str = Field(min_length=10, max_length=2048)


class LinkedInStatusOut(BaseModel):
    oauth_configured: bool
    connected: bool
    linkedin_email: str | None = None
    linkedin_name: str | None = None
    linkedin_picture_url: str | None = None
    linkedin_sub: str | None = None


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


def _linkedin_connected(row: UserLinkedInToken | None) -> bool:
    if row is None:
        return False
    if row.refresh_ciphertext and row.refresh_ciphertext.strip():
        return True
    if row.access_ciphertext and row.access_ciphertext.strip():
        if row.access_expires_at is None:
            return True
        return row.access_expires_at > datetime.now(UTC)
    return False


def _display_from_row(row: UserLinkedInToken | None) -> tuple[str | None, str | None, str | None]:
    if row is None or not isinstance(row.profile_snapshot, dict):
        return None, None, None
    snap = row.profile_snapshot
    email = snap.get("email")
    name = snap.get("name")
    pic = snap.get("picture")
    e_out = email.strip().lower() if isinstance(email, str) and email.strip() else None
    n_out = name.strip() if isinstance(name, str) and name.strip() else None
    p_out = pic.strip() if isinstance(pic, str) and pic.strip() else None
    return e_out, n_out, p_out


@router.get("/status", response_model=LinkedInStatusOut)
def linkedin_status(db: DbDep, current_user: CurrentUserDep) -> LinkedInStatusOut:
    row = db.get(UserLinkedInToken, current_user.id)
    connected = _linkedin_connected(row)
    email, name, pic = _display_from_row(row)
    sub = row.linkedin_sub if row else None
    return LinkedInStatusOut(
        oauth_configured=linkedin_oauth_configured(),
        connected=connected,
        linkedin_email=email,
        linkedin_name=name,
        linkedin_picture_url=pic,
        linkedin_sub=sub,
    )


@router.get("/oauth-url", response_model=LinkedInOAuthUrlOut)
def linkedin_oauth_url(current_user: CurrentUserDep) -> LinkedInOAuthUrlOut:
    if not linkedin_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth is not configured on the server (set DOUBOW_LINKEDIN_OAUTH_*).",
        )
    state = _encode_oauth_state(str(current_user.id))
    try:
        url = build_authorization_url(state=state)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return LinkedInOAuthUrlOut(authorization_url=url, state=state)


def _pick_userinfo_fields(body: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in (
        "sub",
        "name",
        "given_name",
        "family_name",
        "email",
        "email_verified",
        "locale",
        "picture",
    ):
        if key in body:
            out[key] = body[key]
    return out


@router.post("/oauth/callback", response_model=LinkedInStatusOut)
def linkedin_oauth_callback(
    payload: LinkedInOAuthCallbackIn,
    db: DbDep,
    current_user: CurrentUserDep,
) -> LinkedInStatusOut:
    if not linkedin_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth is not configured on the server.",
        )
    _decode_oauth_state(payload.state, expected_sub=str(current_user.id))
    try:
        tok = exchange_code_for_tokens(code=payload.code.strip())
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"LinkedIn token exchange failed: {e!s}") from e

    access = tok.get("access_token")
    if not isinstance(access, str) or not access.strip():
        raise HTTPException(status_code=400, detail="LinkedIn did not return an access_token.")

    refresh_raw = tok.get("refresh_token")
    refresh_plain = (
        refresh_raw.strip() if isinstance(refresh_raw, str) and refresh_raw.strip() else None
    )
    expires_at = access_expires_at_from_token_response(tok)

    try:
        userinfo = fetch_linkedin_userinfo(access.strip())
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"LinkedIn userinfo failed: {e!s}") from e

    snapshot = _pick_userinfo_fields(userinfo)
    sub = snapshot.get("sub")
    sub_s = sub.strip() if isinstance(sub, str) and sub.strip() else None
    email = snapshot.get("email")
    email_s = email.strip().lower() if isinstance(email, str) and email.strip() else None

    refresh_cipher = encrypt_token(refresh_plain) if refresh_plain else None
    access_cipher = encrypt_token(access.strip()) if not refresh_plain else None
    # When we have a refresh token, skip persisting access (derive fresh on demand later).
    if refresh_plain:
        access_cipher = None
        expires_at = None

    existing = db.get(UserLinkedInToken, current_user.id)
    now = datetime.now(UTC)
    if existing is None:
        row = UserLinkedInToken(
            user_id=current_user.id,
            refresh_ciphertext=refresh_cipher,
            access_ciphertext=access_cipher,
            access_expires_at=expires_at,
            linkedin_sub=sub_s,
            primary_email=email_s,
            profile_snapshot=snapshot,
            updated_at=now,
        )
        db.add(row)
    else:
        existing.refresh_ciphertext = refresh_cipher
        existing.access_ciphertext = access_cipher
        existing.access_expires_at = expires_at
        existing.linkedin_sub = sub_s
        existing.primary_email = email_s
        existing.profile_snapshot = snapshot
        existing.updated_at = now

    merge_profile_goals(
        db,
        user_id=current_user.id,
        patch={
            "linkedin_profile": {
                **snapshot,
                "synced_at": now.isoformat(),
            },
        },
    )
    prof = db.scalar(select(Profile).where(Profile.user_id == current_user.id))
    if prof is not None and isinstance(prof.goals, dict):
        g = dict(prof.goals)
        lp = g.get("linkedin_profile")
        if isinstance(lp, dict):
            n = lp.get("name")
            hl = g.get("headline")
            has_hl = isinstance(hl, str) and bool(hl.strip())
            if isinstance(n, str) and n.strip() and not has_hl:
                g["headline"] = n.strip()
                prof.goals = g

    db.commit()
    row = db.get(UserLinkedInToken, current_user.id)
    connected = _linkedin_connected(row)
    le, ln, lpic = _display_from_row(row)
    return LinkedInStatusOut(
        oauth_configured=True,
        connected=connected,
        linkedin_email=le,
        linkedin_name=ln,
        linkedin_picture_url=lpic,
        linkedin_sub=row.linkedin_sub if row else None,
    )


@router.delete("/disconnect", response_model=LinkedInStatusOut)
def linkedin_disconnect(db: DbDep, current_user: CurrentUserDep) -> LinkedInStatusOut:
    row = db.get(UserLinkedInToken, current_user.id)
    if row is not None:
        db.delete(row)
        db.commit()
    clear_goal_keys(db, user_id=current_user.id, keys=("linkedin_profile",))
    db.commit()
    return LinkedInStatusOut(
        oauth_configured=linkedin_oauth_configured(),
        connected=False,
        linkedin_email=None,
        linkedin_name=None,
        linkedin_picture_url=None,
        linkedin_sub=None,
    )


@router.post("/refresh-profile", response_model=LinkedInStatusOut)
def linkedin_refresh_profile(db: DbDep, current_user: CurrentUserDep) -> LinkedInStatusOut:
    """Re-fetch OpenID userinfo using stored tokens (best-effort)."""
    if not linkedin_oauth_configured():
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth is not configured on the server.",
        )
    row = db.get(UserLinkedInToken, current_user.id)
    if row is None or not _linkedin_connected(row):
        raise HTTPException(status_code=400, detail="Connect LinkedIn first.")

    access: str | None = None
    if row.refresh_ciphertext and row.refresh_ciphertext.strip():
        try:
            rt = decrypt_token(row.refresh_ciphertext)
            tok = refresh_with_refresh_token(refresh_token_plain=rt)
            access = tok.get("access_token") if isinstance(tok.get("access_token"), str) else None
            new_refresh = tok.get("refresh_token")
            if isinstance(new_refresh, str) and new_refresh.strip():
                row.refresh_ciphertext = encrypt_token(new_refresh.strip())
            exp = access_expires_at_from_token_response(tok)
            if exp:
                row.access_expires_at = exp
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status_code=502,
                detail=f"LinkedIn token refresh failed: {e!s}",
            ) from e
    elif row.access_ciphertext and row.access_ciphertext.strip():
        if row.access_expires_at and row.access_expires_at <= datetime.now(UTC):
            raise HTTPException(
                status_code=401,
                detail="LinkedIn access expired. Disconnect and connect again.",
            )
        access = decrypt_token(row.access_ciphertext)

    if not access or not access.strip():
        raise HTTPException(status_code=502, detail="Could not obtain LinkedIn access token.")

    try:
        userinfo = fetch_linkedin_userinfo(access.strip())
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"LinkedIn userinfo failed: {e!s}") from e

    snapshot = _pick_userinfo_fields(userinfo)
    sub = snapshot.get("sub")
    row.linkedin_sub = sub.strip() if isinstance(sub, str) and sub.strip() else row.linkedin_sub
    email = snapshot.get("email")
    row.primary_email = (
        email.strip().lower() if isinstance(email, str) and email.strip() else row.primary_email
    )
    row.profile_snapshot = snapshot
    row.updated_at = datetime.now(UTC)

    merge_profile_goals(
        db,
        user_id=current_user.id,
        patch={"linkedin_profile": {**snapshot, "synced_at": row.updated_at.isoformat()}},
    )
    db.commit()
    r2 = db.get(UserLinkedInToken, current_user.id)
    le, ln, lpic = _display_from_row(r2)
    return LinkedInStatusOut(
        oauth_configured=True,
        connected=_linkedin_connected(r2),
        linkedin_email=le,
        linkedin_name=ln,
        linkedin_picture_url=lpic,
        linkedin_sub=r2.linkedin_sub if r2 else None,
    )
