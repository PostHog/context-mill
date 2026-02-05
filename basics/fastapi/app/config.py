"""FastAPI application configuration using Pydantic Settings."""

from functools import lru_cache

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

    # PostHog
    posthog_api_key: str = "<ph_project_api_key>"
    posthog_host: str = "https://us.i.posthog.com"
    posthog_disabled: bool = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
