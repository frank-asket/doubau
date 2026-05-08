from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpsert(BaseModel):
    current_role: str | None = None
    years_experience: str | None = None
    persona: str | None = None
    location: str | None = None
    contact_preferences: str | None = None
    goals: dict | None = None
    plan_tier: str | None = None


class ProfileOut(ProfileUpsert):
    email: EmailStr

