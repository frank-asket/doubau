from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="DOUBOW_", extra="ignore")

    environment: str = "local"
    cors_allow_origins: list[str] = ["http://localhost:3000"]

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/doubow"
    jwt_secret: str = "dev_only_change_me"
    jwt_issuer: str = "doubow"
    jwt_audience: str = "doubow-web"
    jwt_access_token_minutes: int = 30

    # Clerk (optional). If configured, the API will accept Clerk-issued JWTs
    # in the Authorization header (Bearer <token>) in addition to the local HS256 tokens.
    clerk_jwks_url: str | None = None
    clerk_issuer: str | None = None
    clerk_audience: str | None = None

    idempotency_window_hours: int = 24
    idempotency_max_body_bytes: int = 32_768
    idempotency_max_response_bytes: int = 131_072


settings = Settings()

