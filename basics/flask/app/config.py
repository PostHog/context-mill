"""Flask application configuration."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Base configuration."""

    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "dev-secret-key-change-in-production")

    # Database configuration (SQLite like Django example)
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///db.sqlite3")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # PostHog configuration
    POSTHOG_PROJECT_TOKEN = os.environ.get("POSTHOG_PROJECT_TOKEN", "<ph_project_token>")
    POSTHOG_HOST = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")
    POSTHOG_DISABLED = os.environ.get("POSTHOG_DISABLED", "False").lower() == "true"


class DevelopmentConfig(Config):
    """Development configuration."""

    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""

    DEBUG = False


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
