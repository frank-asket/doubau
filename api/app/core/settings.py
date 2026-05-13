import json
import os
from typing import Literal, Self

from cryptography.fernet import Fernet
from pydantic import computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _running_in_container() -> bool:
    """
    Best-effort detection for Docker/Kubernetes-style containers.

    We only use this to decide whether to fall back from an explicit localhost URL to a
    platform-injected DATABASE_URL (e.g. Railway). In local dev, we must not override
    DOUBOW_DATABASE_URL just because it contains "localhost".
    """
    try:
        if os.path.exists("/.dockerenv"):
            return True
    except Exception:
        # If the FS check fails, keep going with other signals.
        pass

    # Common on Linux container runtimes: cgroup includes "docker", "containerd", "kubepods".
    try:
        with open("/proc/1/cgroup") as f:
            cgroup = f.read()
        return any(x in cgroup for x in ("docker", "containerd", "kubepods"))
    except Exception:
        return False


def _parse_cors_allow_origins(raw: str) -> list[str]:
    """Env-friendly CORS: JSON array, comma-separated URLs, or bare hostnames (https added)."""
    s = (raw or "").strip()
    if not s:
        return ["http://localhost:3000"]
    if s.startswith("["):
        parsed = json.loads(s)
        if not isinstance(parsed, list):
            raise ValueError("DOUBOW_CORS_ALLOW_ORIGINS JSON must be an array of strings")
        return [str(x).strip() for x in parsed if str(x).strip()]
    parts = [p.strip() for p in s.split(",") if p.strip()]
    out: list[str] = []
    for p in parts:
        if "://" in p:
            out.append(p)
        elif p.startswith("localhost") or p.startswith("127."):
            out.append(f"http://{p}")
        else:
            out.append(f"https://{p}")
    return out


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _is_valid_fernet_key(raw: str) -> bool:
    """Fernet keys are 32 bytes encoded url-safe base64 (44 chars including padding)."""
    s = raw.strip()
    if len(s) != 44:
        return False
    try:
        Fernet(s.encode("ascii"))
    except (TypeError, ValueError):
        return False
    return True


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="DOUBOW_", extra="ignore")

    environment: str = "local"
    # Comma-separated or JSON array. If you use comma form, bare hostnames get https://
    # (localhost/127.* become http://).
    cors_allow_origins: str = "http://localhost:3000"

    # Leave blank by default so hosting platforms that inject DATABASE_URL (e.g. Railway/Heroku)
    # can be used without also setting DOUBOW_DATABASE_URL. Local dev can set DOUBOW_DATABASE_URL
    # in api/.env, or we'll fall back to a safe localhost default in the validator.
    database_url: str = ""
    jwt_secret: str = "dev_only_change_me"
    jwt_issuer: str = "doubow"
    jwt_audience: str = "doubow-web"
    jwt_access_token_minutes: int = 30

    # Clerk (optional). If configured, the API will accept Clerk-issued JWTs
    # in the Authorization header (Bearer <token>) in addition to the local HS256 tokens.
    clerk_jwks_url: str | None = None
    clerk_issuer: str | None = None
    clerk_audience: str | None = None

    # Comma-separated local user UUIDs or emails allowed for admin ingestion routes.
    admin_ingestion_user_ids: str = ""

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
    # Amazon SES: host ``email-smtp.<region>.amazonaws.com``; use IAM SMTP credentials from the
    # SES console.
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

    # POST /jobs/cron/queue-ingest — optional shared secret for Railway Cron / GitHub Actions.
    # When unset, the route responds with 404 so scanners do not see an auth surface.
    cron_ingest_secret: str | None = None
    # When True, Celery Beat runs Remote OK ingest hourly at :17 UTC (needs worker + Redis).
    ingest_beat_hourly_remoteok: bool = False
    # Queue Remote OK + Adzuna ingest once after API startup (Redis lock; see startup_bootstrap).
    bootstrap_ingest_on_startup: bool = False

    # Optional: LLM-based résumé structuring (keeps matching unblocked on failure).
    resume_llm_structuring_enabled: bool = False
    resume_llm_structuring_max_chars: int = 12_000
    # auto: OpenRouter first, then direct Anthropic, then OpenAI (when respective keys are set).
    resume_structuring_provider: Literal["auto", "claude", "openai", "openrouter"] = "auto"
    # Default False: run parse + embed after POST /me/resume via BackgroundTasks on the API
    # (no Celery worker). True: enqueue ``process_resume_document`` only (needs worker + broker).
    resume_process_via_celery: bool = False

    # Scrapling / Greenhouse-style ingest. These intentionally read the unprefixed SCRAPLING_*
    # names used by the upstream scraper preset, while still allowing DOUBOW_SCRAPLING_* if you
    # prefer this app's standard env prefix.
    scrapling_enabled: bool = _env_bool("SCRAPLING_ENABLED", False)
    scrapling_fixture_json_path: str = os.getenv("SCRAPLING_FIXTURE_JSON_PATH", "")
    scrapling_bundle_fixture: bool = _env_bool("SCRAPLING_BUNDLE_FIXTURE", False)
    scrapling_catalog_in_preset: bool = _env_bool("SCRAPLING_CATALOG_IN_PRESET", True)
    scrapling_timeout_s: int = int(os.getenv("SCRAPLING_TIMEOUT_S", "60") or "60")
    scrapling_auto_greenhouse_board_seeds: bool = _env_bool(
        "SCRAPLING_AUTO_GREENHOUSE_BOARD_SEEDS", False
    )
    scrapling_greenhouse_seed_jobs_per_board: int = int(
        os.getenv("SCRAPLING_GREENHOUSE_SEED_JOBS_PER_BOARD", "5") or "5"
    )
    scrapling_seed_urls: str = os.getenv("SCRAPLING_SEED_URLS", "")
    # Cap total canonical rows persisted per Scrapling ingest run (separate from Adzuna limits).
    scrapling_ingest_max_jobs: int = int(os.getenv("SCRAPLING_INGEST_MAX_JOBS", "100") or "100")

    # Gmail in-app send (OAuth). Redirect URI = Next.js callback (/api/me/google/oauth/callback).
    google_oauth_client_id: str | None = None
    google_oauth_client_secret: str | None = None
    google_oauth_redirect_uri: str | None = None
    # LinkedIn OpenID (Sign In with LinkedIn). Redirect = Next.js /api/me/linkedin/oauth/callback
    linkedin_oauth_client_id: str | None = None
    linkedin_oauth_client_secret: str | None = None
    linkedin_oauth_redirect_uri: str | None = None
    # Optional Fernet key (44-char url-safe base64). If unset, token crypto derives from jwt_secret.
    oauth_token_fernet_key: str | None = None

    @field_validator(
        "google_oauth_client_id",
        "google_oauth_client_secret",
        "google_oauth_redirect_uri",
        "linkedin_oauth_client_id",
        "linkedin_oauth_client_secret",
        "linkedin_oauth_redirect_uri",
        "oauth_token_fernet_key",
        mode="before",
    )
    @classmethod
    def empty_oauth_creds_to_none(cls, v: object) -> object:
        if isinstance(v, str) and not v.strip():
            return None
        return v

    @field_validator("oauth_token_fernet_key", mode="after")
    @classmethod
    def oauth_token_fernet_key_must_be_usable(cls, v: object) -> object:
        if not isinstance(v, str) or not v.strip():
            return None
        return v if _is_valid_fernet_key(v) else None

    @model_validator(mode="after")
    def legacy_google_oauth_env(self) -> Self:
        """Allow unprefixed GOOGLE_OAUTH_* when DOUBOW_GOOGLE_OAUTH_* is unset."""
        patch: dict[str, str | None] = {}

        if not (self.google_oauth_client_id or "").strip():
            v = os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip()
            if v:
                patch["google_oauth_client_id"] = v
        if not (self.google_oauth_client_secret or "").strip():
            v = os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
            if v:
                patch["google_oauth_client_secret"] = v
        if not (self.google_oauth_redirect_uri or "").strip():
            v = os.getenv("GOOGLE_OAUTH_REDIRECT_URI", "").strip()
            if v:
                patch["google_oauth_redirect_uri"] = v
        if not (self.oauth_token_fernet_key or "").strip():
            v = os.getenv("GOOGLE_OAUTH_TOKEN_FERNET_KEY", "").strip()
            if v and _is_valid_fernet_key(v):
                patch["oauth_token_fernet_key"] = v

        if patch:
            return self.model_copy(update=patch)
        return self

    @model_validator(mode="after")
    def legacy_linkedin_oauth_env(self) -> Self:
        """Allow unprefixed LINKEDIN_OAUTH_* when DOUBOW_LINKEDIN_OAUTH_* is unset."""
        patch: dict[str, str | None] = {}

        if not (self.linkedin_oauth_client_id or "").strip():
            v = os.getenv("LINKEDIN_OAUTH_CLIENT_ID", "").strip()
            if v:
                patch["linkedin_oauth_client_id"] = v
        if not (self.linkedin_oauth_client_secret or "").strip():
            v = os.getenv("LINKEDIN_OAUTH_CLIENT_SECRET", "").strip()
            if v:
                patch["linkedin_oauth_client_secret"] = v
        if not (self.linkedin_oauth_redirect_uri or "").strip():
            v = os.getenv("LINKEDIN_OAUTH_REDIRECT_URI", "").strip()
            if v:
                patch["linkedin_oauth_redirect_uri"] = v

        if patch:
            return self.model_copy(update=patch)
        return self

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url_for_psycopg3(cls, v: object) -> object:
        """Railway/Heroku often set DATABASE_URL as postgres:// or postgresql:// without a driver.

        SQLAlchemy then selects the psycopg2 dialect, but this project depends on psycopg v3 only.
        Rewrite bare Postgres URLs to postgresql+psycopg:// so create_engine uses psycopg3.
        """
        if not isinstance(v, str):
            return v
        s = v.strip()
        # Prefer DOUBOW_DATABASE_URL when explicitly set.
        #
        # Only fall back to platform-injected DATABASE_URL when DOUBOW_DATABASE_URL is empty,
        # OR when we're inside a container and DOUBOW_DATABASE_URL points to localhost.
        if not s:
            fallback = os.getenv("DATABASE_URL", "").strip()
            if fallback:
                s = fallback
        else:
            is_localhost = ("localhost" in s) or ("127.0.0.1" in s) or ("[::1]" in s)
            if is_localhost and _running_in_container():
                fallback = os.getenv("DATABASE_URL", "").strip()
                if fallback:
                    s = fallback
        ci = (os.getenv("CI") or "").strip().lower()
        if not s.strip() and ci in {"true", "1", "yes"}:
            # GitHub/GitLab CI often omit DATABASE_URL; imports must still parse a URL.
            s = "postgresql+psycopg://postgres:postgres@127.0.0.1:5432/doubow_ci"
        head = s.split("://", 1)[0]
        if "+" in head:
            return s
        if s.startswith("postgres://"):
            return "postgresql+psycopg://" + s[len("postgres://") :]
        if s.startswith("postgresql://"):
            return "postgresql+psycopg://" + s[len("postgresql://") :]
        return s

    @field_validator("redis_url", mode="before")
    @classmethod
    def normalize_redis_url_for_platforms(cls, v: object) -> object:
        """Prefer DOUBOW_REDIS_URL, with Railway/Heroku-style REDIS_URL as a fallback."""
        if not isinstance(v, str):
            return v
        s = v.strip()
        if not s:
            return os.getenv("REDIS_URL", "").strip() or s

        is_local = (
            "localhost" in s
            or "127.0.0.1" in s
            or "[::1]" in s
            or "redis:6379" in s
        )
        if is_local and _running_in_container():
            fallback = os.getenv("REDIS_URL", "").strip()
            if fallback:
                return fallback
        return s

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def normalize_openai_key(cls, v: object) -> object:
        """
        Prefer DOUBOW_OPENAI_API_KEY (this project's convention), but allow the common
        OPENAI_API_KEY as a fallback so deployments don't silently break Copilot/embeddings.
        """
        if isinstance(v, str) and v.strip():
            return v.strip()
        fallback = os.getenv("OPENAI_API_KEY", "").strip()
        return fallback or None

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

    @field_validator(
        "smtp_host",
        "smtp_user",
        "smtp_password",
        "smtp_from",
        "linkedin_dispatch_webhook_url",
        mode="before",
    )
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

    @computed_field
    def cors_allow_origins_list(self) -> list[str]:
        return _parse_cors_allow_origins(self.cors_allow_origins)

    @computed_field
    def admin_ingestion_user_ids_list(self) -> list[str]:
        raw = (self.admin_ingestion_user_ids or "").strip()
        if not raw:
            return []
        return [x.strip() for x in raw.split(",") if x.strip()]


settings = Settings()
