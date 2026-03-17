"""PostHog client initialization using the documented Posthog() constructor.

Creates a shared client instance that routes and middleware import from.
@see https://posthog.com/docs/libraries/python
"""

from posthog import Posthog

from app.config import get_settings

settings = get_settings()

# Initialize PostHog using the documented constructor pattern.
# This creates a client instance that all routes and middleware share.
# @see https://posthog.com/docs/libraries/python
if not settings.posthog_disabled:
    posthog = Posthog(
        settings.posthog_project_token,
        host=settings.posthog_host,
        debug=settings.debug,
        enable_exception_autocapture=True,
    )
else:
    # Create a disabled client so imports don't break
    posthog = Posthog(
        "disabled",
        host=settings.posthog_host,
        disabled=True,
    )
