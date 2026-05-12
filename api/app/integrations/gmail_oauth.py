"""Google OAuth (authorization code) + Gmail API send — httpx only (no google-api client)."""

from __future__ import annotations

import base64
import json
import re
import urllib.parse
from email.message import EmailMessage
from typing import Any

import httpx

from app.core.settings import settings
from app.integrations.token_crypto import decrypt_secret, encrypt_secret

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

# openid + email for userinfo; gmail.send to post messages from the user's mailbox.
DEFAULT_SCOPES = (
    "openid "
    "https://www.googleapis.com/auth/userinfo.email "
    "https://www.googleapis.com/auth/gmail.send"
)


def google_oauth_configured() -> bool:
    return bool(
        (settings.google_oauth_client_id or "").strip()
        and (settings.google_oauth_client_secret or "").strip()
        and (settings.google_oauth_redirect_uri or "").strip()
    )


def build_authorization_url(*, state: str) -> str:
    if not google_oauth_configured():
        raise RuntimeError("google_oauth_not_configured")
    cid = settings.google_oauth_client_id or ""
    redir = settings.google_oauth_redirect_uri or ""
    params = {
        "client_id": cid,
        "redirect_uri": redir,
        "response_type": "code",
        "scope": DEFAULT_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"


def exchange_code_for_tokens(*, code: str) -> dict[str, Any]:
    if not google_oauth_configured():
        raise RuntimeError("google_oauth_not_configured")
    data = {
        "code": code,
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "grant_type": "authorization_code",
    }
    r = httpx.post(GOOGLE_TOKEN_URL, data=data, timeout=30.0)
    r.raise_for_status()
    return r.json()


def refresh_access_token(*, refresh_token_plain: str) -> dict[str, Any]:
    data = {
        "client_id": settings.google_oauth_client_id,
        "client_secret": settings.google_oauth_client_secret,
        "refresh_token": refresh_token_plain,
        "grant_type": "refresh_token",
    }
    r = httpx.post(GOOGLE_TOKEN_URL, data=data, timeout=30.0)
    r.raise_for_status()
    return r.json()


def fetch_google_account_email(access_token: str) -> str | None:
    r = httpx.get(
        GOOGLE_USERINFO_URL,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=20.0,
    )
    if not r.is_success:
        return None
    body = r.json()
    if isinstance(body, dict):
        email = body.get("email")
        if isinstance(email, str) and email.strip():
            return email.strip().lower()
    return None


def encrypt_refresh_token(refresh_token: str) -> str:
    return encrypt_secret(refresh_token)


def decrypt_refresh_token(ciphertext: str) -> str:
    return decrypt_secret(ciphertext)


def _rfc822_raw(*, from_addr: str, to_addr: str, subject: str, body: str) -> str:
    msg = EmailMessage()
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(body, subtype="plain", charset="utf-8")
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("ascii")
    return raw


def send_plaintext_email(
    *,
    refresh_token_cipher: str,
    from_addr: str,
    to_addr: str,
    subject: str,
    body: str,
) -> dict[str, Any]:
    """Send one message via Gmail API using a refresh token (decrypted from DB)."""
    rt = decrypt_refresh_token(refresh_token_cipher)
    tok = refresh_access_token(refresh_token_plain=rt)
    access = tok.get("access_token")
    if not isinstance(access, str) or not access.strip():
        raise RuntimeError("no_access_token")

    raw = _rfc822_raw(
        from_addr=from_addr,
        to_addr=to_addr.strip(),
        subject=subject.strip(),
        body=body,
    )
    payload = json.dumps({"raw": raw})
    r = httpx.post(
        GMAIL_SEND_URL,
        headers={"Authorization": f"Bearer {access}", "Content-Type": "application/json"},
        content=payload.encode("utf-8"),
        timeout=45.0,
    )
    r.raise_for_status()
    return r.json()


def suggest_recipient_from_job_url(source_url: str | None) -> str | None:
    """Best-effort careers@domain from listing URL (user should verify before send)."""
    if not source_url or not source_url.strip():
        return None
    try:
        host = urllib.parse.urlparse(source_url.strip()).hostname or ""
    except Exception:
        return None
    host = host.lower().removeprefix("www.")
    if not host or "." not in host:
        return None
    # Skip obvious aggregators / boards where careers@domain is wrong.
    blocked = (
        "linkedin.com",
        "indeed.com",
        "glassdoor.com",
        "greenhouse.io",
        "lever.co",
        "workday.com",
        "myworkdayjobs.com",
        "ziprecruiter.com",
        "remoteok.com",
    )
    if any(host == b or host.endswith("." + b) for b in blocked):
        return None
    parts = host.split(".")
    if len(parts) < 2:
        return None
    root = ".".join(parts[-2:])
    return f"careers@{root}"


def is_valid_recipient_email(addr: str) -> bool:
    s = addr.strip()
    if len(s) > 254 or "@" not in s:
        return False
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", s))
