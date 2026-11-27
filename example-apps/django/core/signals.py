"""PostHog identity for the login request.

The middleware reads request.user once, before any view runs. On a login request
the visitor is still anonymous at that point, so the request context has no
distinct ID, and calling login() inside the view does not change that. This
signal runs inside the login request and identifies the ambient context, so
every capture later in that same request is attributed to the user who just
logged in. Requests made after login do not need this because the middleware
sees the authenticated user from the start.
"""

from django.conf import settings
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from posthog import identify_context


@receiver(user_logged_in)
def identify_posthog_user(sender, request, user, **kwargs):
    # Skip identification if the user has no primary key rather than inventing a fallback ID.
    if user is None or user.pk is None:
        return

    user_id = str(user.pk)
    identify_context(user_id)

    # Guard against missing PostHog configuration so login still works without a token.
    client = settings.POSTHOG_MW_CLIENT
    if client:
        # PII belongs in person properties via set(), never in capture() event properties.
        client.set(
            distinct_id=user_id,
            properties={
                'email': user.email,
                'username': user.username,
                'name': user.get_full_name() or user.username,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined.isoformat(),
            },
        )
