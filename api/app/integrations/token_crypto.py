"""Encrypt short secrets at rest (e.g. Google refresh tokens).

Uses Fernet; key from DOUBOW_OAUTH_TOKEN_FERNET_KEY or derived from DOUBOW_JWT_SECRET.
"""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.settings import settings


def _fernet() -> Fernet:
    explicit = (settings.oauth_token_fernet_key or "").strip()
    if explicit:
        return Fernet(explicit.encode("ascii"))
    raw = hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_secret(token: str) -> str:
    return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
