"""Flask extensions initialized without binding to app."""

from flask_login import LoginManager
from flask_sqlalchemy import SQLAlchemy
from posthog import Posthog

from app.config import Config

db = SQLAlchemy()

# Shared PostHog client. The SDK's module-level helpers (`from posthog import
# capture`) route to a separate default client configured only by module-level
# settings — mixing them with a constructor-built client silently drops events.
# All captures and flag checks must go through this instance. Context helpers
# (new_context, identify_context, tag) are safe to import module-level: the
# context stack is process-global and applies to captures from this instance.
posthog_client = Posthog(
    Config.POSTHOG_PROJECT_TOKEN,
    host=Config.POSTHOG_HOST,
    disabled=Config.POSTHOG_DISABLED,
)

login_manager = LoginManager()
login_manager.login_view = "main.home"
login_manager.login_message = "Please log in to access this page."
