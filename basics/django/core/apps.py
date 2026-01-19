"""
Django AppConfig that initializes PostHog when the application starts.

This ensures the SDK is configured once when Django starts, making it available throughout the application.
"""

from django.apps import AppConfig
from django.conf import settings


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """
        Initialize PostHog when Django starts.

        This method is called once when Django starts. We configure the
        PostHog SDK here so it's available everywhere in the application.

        Note: Import posthog inside this method to avoid import issues
        during Django's startup sequence.
        """
        import posthog

        # Configure PostHog with settings from Django settings
        posthog.api_key = settings.POSTHOG_API_KEY
        posthog.host = settings.POSTHOG_HOST

        # Disable PostHog if configured (useful for testing)
        if settings.POSTHOG_DISABLED:
            posthog.disabled = True

        # Optional: Enable debug mode in development
        if settings.DEBUG:
            posthog.debug = True
