from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.api.deps import DbDep
from app.api.schemas import AuthResponse, LoginRequest, SignupRequest
from app.models.profile import Profile
from app.models.user import User
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=AuthResponse)
def signup(payload: SignupRequest, db: DbDep) -> AuthResponse:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already in use")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()

    profile = Profile(user_id=user.id, goals={})
    db.add(profile)
    db.commit()

    token = create_access_token(user_id=user.id, email=user.email)
    return AuthResponse(access_token=token)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: DbDep) -> AuthResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=user.id, email=user.email)
    return AuthResponse(access_token=token)

