from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.user import User
from app.security import decode_any_access_token, hash_password

bearer = HTTPBearer(auto_error=False)


DbDep = Annotated[Session, Depends(get_db)]


def user_from_token_payload(db: Session, payload: dict) -> User:
    """Resolve a ``User`` from a decoded JWT payload (shared by REST + WebSocket)."""
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Invalid token")

    try:
        user_id = UUID(str(sub))
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except ValueError:
        email = payload.get("email")
        if not isinstance(email, str) or not email:
            raise HTTPException(status_code=401, detail="Invalid token") from None

        user = db.query(User).filter(User.email == email).one_or_none()
        if user is not None:
            return user

        user = User(email=email, password_hash=hash_password(f"clerk:{sub}"))
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


async def get_current_user(
    db: DbDep,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = await decode_any_access_token(creds.credentials)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=401, detail="Invalid token") from e

    return user_from_token_payload(db, payload)


CurrentUserDep = Annotated[User, Depends(get_current_user)]

