"""
Django AppConfig that wires up PostHog authentication signals on startup.

The Posthog client itself is constructed in posthog_example/settings.py as POSTHOG_MW_CLIENT.
"""

from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """Register the auth signal that identifies the login request context."""
        from . import signals  # noqa: F401
