"""FastAPI application configuration using Pydantic Settings."""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    secret_key: str = "dev-secret-key-change-in-production"
    debug: bool = True

    # Database (SQLite like Flask example)
    database_url: str = "sqlite:///./db.sqlite3"

    # Leave the PostHog token as None when unset rather than defaulting to an empty or placeholder key,
    # so unconfigured environments skip client creation cleanly instead of sending invalid requests.
    posthog_project_token: Optional[str] = None
    posthog_host: str = "https://us.i.posthog.com"
    posthog_disabled: bool = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
