"""LinkedIn OAuth (authorization code) + OpenID userinfo for profile sync — httpx only."""

from __future__ import annotations

import urllib.parse
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.core.settings import settings
from app.integrations.token_crypto import decrypt_secret, encrypt_secret

LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo"

# Sign In with LinkedIn (OpenID Connect) — member name, email, photo where approved.
DEFAULT_SCOPES = "openid profile email"


def linkedin_oauth_configured() -> bool:
    return bool(
        (settings.linkedin_oauth_client_id or "").strip()
        and (settings.linkedin_oauth_client_secret or "").strip()
        and (settings.linkedin_oauth_redirect_uri or "").strip()
    )


def build_authorization_url(*, state: str) -> str:
    if not linkedin_oauth_configured():
        raise RuntimeError("linkedin_oauth_not_configured")
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_oauth_client_id or "",
        "redirect_uri": settings.linkedin_oauth_redirect_uri or "",
        "scope": DEFAULT_SCOPES,
        "state": state,
    }
    return f"{LINKEDIN_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code_for_tokens(*, code: str) -> dict[str, Any]:
    if not linkedin_oauth_configured():
        raise RuntimeError("linkedin_oauth_not_configured")
    data = {
        "grant_type": "authorization_code",
        "code": code.strip(),
        "redirect_uri": settings.linkedin_oauth_redirect_uri or "",
        "client_id": settings.linkedin_oauth_client_id or "",
        "client_secret": settings.linkedin_oauth_client_secret or "",
    }
    r = httpx.post(
        LINKEDIN_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30.0,
    )
    r.raise_for_status()
    return r.json()


def refresh_with_refresh_token(*, refresh_token_plain: str) -> dict[str, Any]:
    if not linkedin_oauth_configured():
        raise RuntimeError("linkedin_oauth_not_configured")
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token_plain,
        "client_id": settings.linkedin_oauth_client_id or "",
        "client_secret": settings.linkedin_oauth_client_secret or "",
    }
    r = httpx.post(
        LINKEDIN_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=30.0,
    )
    r.raise_for_status()
    return r.json()


def fetch_linkedin_userinfo(access_token: str) -> dict[str, Any]:
    r = httpx.get(
        LINKEDIN_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token.strip()}"},
        timeout=20.0,
    )
    r.raise_for_status()
    body = r.json()
    return body if isinstance(body, dict) else {}


def encrypt_token(plain: str) -> str:
    return encrypt_secret(plain)


def decrypt_token(ciphertext: str) -> str:
    return decrypt_secret(ciphertext)


def access_expires_at_from_token_response(tok: dict[str, Any]) -> datetime | None:
    raw = tok.get("expires_in")
    try:
        sec = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if sec <= 0:
        return None
    return datetime.now(UTC) + timedelta(seconds=sec)
