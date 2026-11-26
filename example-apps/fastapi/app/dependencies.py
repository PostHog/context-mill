"""Authentication and PostHog dependencies for FastAPI."""

from typing import Annotated, Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from itsdangerous import BadSignature, URLSafeSerializer
from posthog import Posthog, identify_context, tag
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

settings = get_settings()
serializer = URLSafeSerializer(settings.secret_key)


def get_posthog(request: Request) -> Optional[Posthog]:
    """Retrieve the shared PostHog client attached at app startup, or None when unconfigured."""
    return getattr(request.app.state, "posthog", None)


def get_session_user_id(session_token: Annotated[Optional[str], Cookie()] = None) -> Optional[int]:
    """Extract user ID from session cookie."""
    if not session_token:
        return None
    try:
        data = serializer.loads(session_token)
        return data.get("user_id")
    except BadSignature:
        return None


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    user_id: Annotated[Optional[int], Depends(get_session_user_id)],
) -> Optional[User]:
    """Get the current authenticated user, or None if not authenticated."""
    if user_id is None:
        return None
    user = User.get_by_id(db, user_id)
    # Only identify the ASGI request context when an authenticated user resolves, never with a shared fallback ID.
    if user is not None:
        identify_context(str(user.id))
        tag("is_staff", user.is_staff)
    return user


def require_auth(
    current_user: Annotated[Optional[User], Depends(get_current_user)],
) -> User:
    """Require authentication and raise 401 if not authenticated."""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return current_user


def create_session_token(user_id: int) -> str:
    """Create a signed session token for the user."""
    return serializer.dumps({"user_id": user_id})


# Type aliases for cleaner dependency injection
CurrentUser = Annotated[Optional[User], Depends(get_current_user)]
RequiredUser = Annotated[User, Depends(require_auth)]
DbSession = Annotated[Session, Depends(get_db)]
PostHogClient = Annotated[Optional[Posthog], Depends(get_posthog)]
