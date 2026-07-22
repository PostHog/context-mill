"""PostHog identity for the login request.

The middleware reads request.user once, before any view runs. On a login request
the visitor is still anonymous at that point, so the request's context has no
distinct ID, and calling login() inside the view does not change that. This
signal runs inside the login request and identifies the ambient context, so
every capture later in that same request is attributed to the user who just
logged in. Requests made after login don't need this: the middleware sees the
authenticated user from the start.
"""

import posthog
from posthog import identify_context
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver


@receiver(user_logged_in)
def identify_posthog_user(sender, request, user, **kwargs):
    identify_context(str(user.pk))

    # PII belongs in person properties, never in event properties.
    posthog.set(
        distinct_id=str(user.pk),
        properties={
            'email': user.email,
            'username': user.username,
            'name': user.get_full_name() or user.username,
            'is_staff': user.is_staff,
            'date_joined': user.date_joined.isoformat(),
        },
    )
