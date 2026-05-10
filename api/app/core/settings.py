from typing import Literal

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

    # Anthropic Claude (optional résumé structuring via Messages API).
    anthropic_api_key: str | None = None
    anthropic_chat_model: str = "claude-3-5-haiku-20241022"

    # OpenRouter — OpenAI-compatible API; use one key for Claude/GPT/etc. (optional structuring).
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_chat_model: str = "anthropic/claude-3.5-haiku"
    openrouter_http_referer: str | None = None
    openrouter_app_title: str | None = "DouBow"
    embedding_dimensions: int = 1536
    embedding_max_input_chars: int = 30_000

    # Phase 3 — outbound email (SMTP). When unset, dispatch logs intent without sending mail.
    # Amazon SES: host ``email-smtp.<region>.amazonaws.com``; use IAM SMTP credentials from SES console.
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    # STARTTLS after connect (typical for SES port 587).
    smtp_use_tls: bool = True
    # Implicit TLS (typical for SES port 465). If true, ``smtp_use_tls`` is ignored.
    smtp_use_ssl: bool = False

    # Optional webhook for LinkedIn-adjacent automation (no official API here).
    linkedin_dispatch_webhook_url: str | None = None

    # Scraper: max HTTP GETs per host per minute (token bucket via Redis).
    scrape_max_requests_per_host_per_minute: int = 30
    # RSS ingest: max item links enqueued per feed (each becomes a scrape_job child task).
    scrape_rss_max_entries: int = 25
    s3_job_html_prefix: str = "job-html"

    # Remote OK public JSON API (v1 global-remote). Honor their ToS: link to the job on Remote OK.
    remoteok_api_url: str = "https://remoteok.com/api"
    remoteok_ingest_max_jobs: int = 100

    # Cross-listing dedup: Redis SET NX per ``hash(title|company|location)`` (default 48h).
    job_content_fingerprint_ttl_seconds: int = 172800

    # Adzuna REST API (optional — free tier keys from developer.adzuna.com).
    adzuna_app_id: str | None = None
    adzuna_app_key: str | None = None
    adzuna_country_code: str = "gb"
    # Adzuna keyword filter; empty = broad results. Set env for your sector (e.g. nursing, sales).
    adzuna_search_what: str = ""
    adzuna_max_results: int = 50

    # Freshness: exclude jobs older than N days by default (posted_at else created_at).
    jobs_stale_after_days: int = 30

    # Optional: LLM-based résumé structuring (keeps matching unblocked on failure).
    resume_llm_structuring_enabled: bool = False
    resume_llm_structuring_max_chars: int = 12_000
    # auto: OpenRouter first, then direct Anthropic, then OpenAI (when respective keys are set).
    resume_structuring_provider: Literal["auto", "claude", "openai", "openrouter"] = "auto"

    @field_validator("openai_api_key", "anthropic_api_key", "openrouter_api_key", mode="before")
    @classmethod
    def empty_llm_keys_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("s3_endpoint_url", "s3_access_key_id", "s3_secret_access_key", mode="before")
    @classmethod
    def empty_s3_optional_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("adzuna_app_id", "adzuna_app_key", mode="before")
    @classmethod
    def empty_adzuna_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("smtp_host", "smtp_user", "smtp_password", "smtp_from", "linkedin_dispatch_webhook_url", mode="before")
    @classmethod
    def empty_smtp_optional_to_none(cls, v: object) -> object:
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
