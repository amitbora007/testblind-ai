import os
from pathlib import Path
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_backend_dir = Path(__file__).resolve().parent.parent.parent  # /backend
_root_dir = _backend_dir.parent

_env_files = (
    str(_backend_dir / ".env"),
    str(_root_dir / ".env"),
    ".env",
    "backend/.env",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_files,
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "TestBlind AI Control Plane"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    SECRET_KEY: str = "testblind-super-secret-jwt-key-for-development-change-in-prod-32bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # LLM Synthesis Providers & Models
    DEFAULT_LLM_PROVIDER: str = "local"  # "local" | "anthropic" | "openai" | "gemini"
    DEFAULT_LLM_MODEL: Union[str, None] = "gemini-2.5-flash"
    ANTHROPIC_API_KEY: Union[str, None] = None
    OPENAI_API_KEY: Union[str, None] = None
    GEMINI_API_KEY: Union[str, None] = None
    LLM_TEMPERATURE: float = 0.1
    LLM_TIMEOUT_SECONDS: int = 30

    # GitHub App & OAuth Integration (Optional environment secrets)
    GITHUB_CLIENT_ID: Union[str, None] = None
    GITHUB_CLIENT_SECRET: Union[str, None] = None
    GITHUB_APP_ID: Union[str, None] = None

    # Archive Upload & Storage Quotas
    UPLOAD_MAX_SIZE_BYTES: int = 100 * 1024 * 1024  # 100 MB

    # Execution Infrastructure & Sandbox Quotas
    MAX_CONCURRENT_WORKERS: int = 4
    MAX_TENANT_CONCURRENT_RUNS: int = 2
    EXECUTION_MAX_MEMORY_MB: int = 512
    EXECUTION_MAX_OUTPUT_BYTES: int = 1024 * 1024  # 1MB output stream buffer limit
    DOCKER_HOST_SOCKET: str = "/var/run/docker.sock"
    SANDBOX_BASE_DIR: str = "/tmp/testblind_sandboxes"

    FRONTEND_URL: Union[str, None] = None

    # CORS Origins
    BACKEND_CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            stripped = v.strip()
            if stripped.startswith("[") and stripped.endswith("]"):
                try:
                    import json
                    parsed = json.loads(stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        elif isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return []

    @model_validator(mode="after")
    def add_frontend_url_to_cors(self) -> "Settings":
        if self.FRONTEND_URL:
            clean_url = self.FRONTEND_URL.strip().rstrip("/")
            if clean_url and isinstance(self.BACKEND_CORS_ORIGINS, list):
                if clean_url not in self.BACKEND_CORS_ORIGINS:
                    self.BACKEND_CORS_ORIGINS.append(clean_url)
        return self

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "testblind_admin"
    POSTGRES_PASSWORD: str = "testblind_dev_password_change_me"
    POSTGRES_DB: str = "testblind_db"
    DATABASE_URL: Union[str, None] = None

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            # Normalize Render/Heroku postgres:// or postgresql:// to SQLAlchemy asyncpg dialect
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL.strip()
            # Normalize Render/Heroku postgres://, asyncpg, or postgresql:// to sync psycopg2
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+psycopg2://", 1)
            elif url.startswith("postgresql+asyncpg://"):
                return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
            elif url.startswith("postgresql://"):
                return url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
