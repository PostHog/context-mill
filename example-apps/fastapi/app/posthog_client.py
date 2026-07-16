"""Shared PostHog client instance.

The SDK's module-level helpers (`from posthog import capture`) route to a
separate default client configured only by module-level settings — mixing them
with a constructor-built client silently drops events. All captures and flag
checks must go through this instance. Context helpers (new_context,
identify_context, tag) are safe to import module-level: the context stack is
process-global and applies to captures from this instance.
"""

from posthog import Posthog

from app.config import get_settings

settings = get_settings()

posthog_client = Posthog(
    settings.posthog_project_token,
    host=settings.posthog_host,
    debug=settings.debug,
    disabled=settings.posthog_disabled,
)
