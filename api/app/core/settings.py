from pydantic import field_validator
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

    # Celery / Redis
    redis_url: str = "redis://localhost:6379/0"
    dlq_redis_key: str = "doubow:dlq"

    # S3 (or compatible, e.g. MinIO). For real AWS S3: leave endpoint unset/empty and use
    # eu-west-3 (or your bucket region). Optional keys: omit both to use the default AWS
    # credential chain (env vars, ~/.aws/credentials, IAM role, etc.).
    s3_endpoint_url: str | None = None
    s3_region: str = "eu-west-3"
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_bucket_resumes: str = "s3-resumes-888687695411"
    # Must stay aligned with Terraform variable resume_object_prefix (IAM resource ARN).
    s3_resume_object_prefix: str = "resumes"

    # OpenAI résumé embeddings (Phase 1). Optional locally; set in prod for EMBEDDED status.
    openai_api_key: str | None = None
    openai_embedding_model: str = "text-embedding-3-small"
    # Chat model for fit scorer and later agents (Phase 2+).
    openai_chat_model: str = "gpt-4o-mini"
    embedding_dimensions: int = 1536
    embedding_max_input_chars: int = 30_000

    # Scraper: max HTTP GETs per host per minute (token bucket via Redis).
    scrape_max_requests_per_host_per_minute: int = 30
    # RSS ingest: max item links enqueued per feed (each becomes a scrape_job child task).
    scrape_rss_max_entries: int = 25
    s3_job_html_prefix: str = "job-html"

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def empty_openai_key_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("s3_endpoint_url", "s3_access_key_id", "s3_secret_access_key", mode="before")
    @classmethod
    def empty_s3_optional_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("s3_resume_object_prefix", mode="before")
    @classmethod
    def normalize_resume_prefix(cls, v: object) -> object:
        if isinstance(v, str):
            return v.strip().strip("/") or "resumes"
        return v


settings = Settings()

