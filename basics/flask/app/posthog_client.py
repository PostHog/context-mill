"""PostHog client initialization using the documented Posthog() constructor.

Creates a shared client instance that routes and error handlers import from.
@see https://posthog.com/docs/libraries/python
"""

from posthog import Posthog

from app.config import config

# Use the default (development) config to read PostHog settings.
# The app factory may override config_name, but PostHog settings
# are the same across environments — only POSTHOG_DISABLED differs.
settings = config["default"]

if not settings.POSTHOG_DISABLED:
    posthog = Posthog(
        settings.POSTHOG_PROJECT_TOKEN,
        host=settings.POSTHOG_HOST,
        debug=getattr(settings, "DEBUG", False),
        enable_exception_autocapture=True,
    )
else:
    posthog = Posthog(
        "disabled",
        host=settings.POSTHOG_HOST,
        disabled=True,
    )
