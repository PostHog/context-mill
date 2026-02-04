"""PostHog middleware for automatic context and user identification.

Uses pure ASGI middleware instead of BaseHTTPMiddleware for better performance/best practices.
"""

from http.cookies import SimpleCookie
from typing import Callable, Optional

from posthog import identify_context, new_context, tag

from app.config import get_settings
from app.database import SessionLocal
from app.dependencies import serializer
from app.models import User


class PostHogMiddleware:
    """Pure ASGI middleware that wraps each request in a PostHog context.

    If the user is authenticated, identifies them in the context so routes
    can just call capture() without needing to set up context each time.

    Uses pure ASGI interface for better performance than BaseHTTPMiddleware.
    """

    def __init__(self, app):
        self.app = app
        self.settings = get_settings()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or self.settings.posthog_disabled:
            await self.app(scope, receive, send)
            return

        user = self._get_user_from_scope(scope)

        with new_context():
            if user:
                identify_context(user.email)
                tag("email", user.email)
                tag("is_staff", user.is_staff)

            await self.app(scope, receive, send)

    def _get_user_from_scope(self, scope) -> Optional[User]:
        """Extract authenticated user from session cookie in ASGI scope."""
        headers = dict(scope.get("headers", []))
        cookie_header = headers.get(b"cookie", b"").decode("utf-8")

        if not cookie_header:
            return None

        cookies = SimpleCookie()
        cookies.load(cookie_header)

        session_cookie = cookies.get("session_token")
        if not session_cookie:
            return None

        session_token = session_cookie.value

        try:
            data = serializer.loads(session_token)
            user_id = data.get("user_id")
        except Exception:
            return None

        if not user_id:
            return None

        db = SessionLocal()
        try:
            return User.get_by_id(db, user_id)
        finally:
            db.close()
