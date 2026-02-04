"""PostHog middleware for automatic context and user identification."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from posthog import identify_context, new_context, tag

from app.config import get_settings
from app.database import SessionLocal
from app.dependencies import serializer
from app.models import User

settings = get_settings()


class PostHogMiddleware(BaseHTTPMiddleware):
    """Middleware that wraps each request in a PostHog context.

    If the user is authenticated, identifies them in the context so routes
    can just call capture() without needing to set up context each time.
    """

    async def dispatch(self, request: Request, call_next):
        if settings.posthog_disabled:
            return await call_next(request)

        user = self._get_user_from_request(request)

        with new_context():
            if user:
                identify_context(user.email)
                tag("email", user.email)
                tag("is_staff", user.is_staff)

            response = await call_next(request)

        return response

    def _get_user_from_request(self, request: Request):
        """Extract authenticated user from session cookie."""
        session_token = request.cookies.get("session_token")
        if not session_token:
            return None

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
