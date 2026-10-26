from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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

    # GitHub App & OAuth Integration (Optional environment secrets)
    GITHUB_CLIENT_ID: Union[str, None] = None
    GITHUB_CLIENT_SECRET: Union[str, None] = None
    GITHUB_APP_ID: Union[str, None] = None
    GITHUB_APP_PRIVATE_KEY_PATH: Union[str, None] = None
    GITHUB_WEBHOOK_SECRET: Union[str, None] = None

    # Archive Upload & Storage Quotas
    UPLOAD_MAX_SIZE_BYTES: int = 100 * 1024 * 1024  # 100 MB
    UPLOAD_RETENTION_HOURS: int = 24

    # Execution Infrastructure & Sandbox Quotas
    MAX_CONCURRENT_WORKERS: int = 4
    MAX_TENANT_CONCURRENT_RUNS: int = 2
    EXECUTION_DEFAULT_TIMEOUT_SECONDS: int = 30
    EXECUTION_WALL_TIMEOUT_SECONDS: int = 60
    EXECUTION_MAX_MEMORY_MB: int = 512
    EXECUTION_MAX_OUTPUT_BYTES: int = 1024 * 1024  # 1MB output stream buffer limit
    REDIS_URL: Union[str, None] = "redis://localhost:6379/0"
    DOCKER_HOST_SOCKET: str = "/var/run/docker.sock"
    SANDBOX_BASE_DIR: str = "/tmp/testblind_sandboxes"

    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:4173",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:5173",
    ]

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
            # Ensure asyncpg dialect
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            if self.DATABASE_URL.startswith("postgresql+asyncpg://"):
                return self.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()
