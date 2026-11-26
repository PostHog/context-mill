"""Main routes demonstrating PostHog integration patterns."""

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Cookie, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from posthog import identify_context, new_context

from app.dependencies import (
    CurrentUser,
    DbSession,
    PostHogClient,
    RequiredUser,
    create_session_token,
)
from app.models import User

router = APIRouter()

# Setup templates
templates_dir = Path(__file__).parent.parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))


@router.get("/", response_class=HTMLResponse)
async def home(request: Request, current_user: CurrentUser, db: DbSession):
    """Home and login page."""
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)

    return templates.TemplateResponse(
        request, "home.html", {"current_user": current_user}
    )


@router.post("/", response_class=HTMLResponse)
async def login(
    request: Request,
    db: DbSession,
    posthog_client: PostHogClient,
    email: Annotated[str, Form()] = "",
    password: Annotated[str, Form()] = "",
):
    """Handle login form submission."""
    clean_email = email.strip()
    # Reject empty credentials before authentication and omit analytics calls when no user resolves.
    if not clean_email or not password:
        return templates.TemplateResponse(
            request,
            "home.html",
            {"current_user": None, "error": "Email and password are required"},
        )

    user = User.authenticate(db, clean_email, password)

    if user:
        is_new_user = user.record_login(db)
        if posthog_client:
            user_id = str(user.id)
            with new_context(client=posthog_client):
                identify_context(user_id)
                posthog_client.set(
                    distinct_id=user_id,
                    properties={"email": user.email, "is_staff": user.is_staff},
                )
                posthog_client.capture(
                    "user_logged_in",
                    properties={
                        "is_new_user": is_new_user,
                        "login_method": "password",
                    },
                )

        response = RedirectResponse(url="/dashboard", status_code=302)
        response.set_cookie(
            key="session_token",
            value=create_session_token(user.id),
            httponly=True,
            samesite="lax",
        )
        return response

    return templates.TemplateResponse(
        request,
        "home.html",
        {"current_user": None, "error": "Invalid email or password"},
    )


@router.get("/signup", response_class=HTMLResponse)
async def signup_page(request: Request, current_user: CurrentUser):
    """User registration page."""
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)

    return templates.TemplateResponse(
        request, "signup.html", {"current_user": current_user}
    )


@router.post("/signup", response_class=HTMLResponse)
async def signup(
    request: Request,
    db: DbSession,
    posthog_client: PostHogClient,
    email: Annotated[str, Form()] = "",
    password: Annotated[str, Form()] = "",
    password_confirm: Annotated[str, Form()] = "",
):
    """Handle signup form submission."""
    clean_email = email.strip()
    error = None

    # Validate signup input before creating a user so invalid submissions never emit analytics.
    if not clean_email or not password:
        error = "Email and password are required"
    elif password != password_confirm:
        error = "Passwords do not match"
    elif User.get_by_email(db, clean_email):
        error = "Email already registered"

    if error:
        return templates.TemplateResponse(
            request, "signup.html", {"current_user": None, "error": error}
        )

    user = User.create_user(db, email=clean_email, password=password, is_staff=False)

    if posthog_client:
        user_id = str(user.id)
        with new_context(client=posthog_client):
            identify_context(user_id)
            posthog_client.set(
                distinct_id=user_id,
                properties={
                    "email": user.email,
                    "is_staff": user.is_staff,
                    "date_joined": user.date_joined.isoformat(),
                },
            )
            posthog_client.capture(
                "user_signed_up",
                properties={"signup_method": "form"},
            )

    response = RedirectResponse(url="/dashboard", status_code=302)
    response.set_cookie(
        key="session_token",
        value=create_session_token(user.id),
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/logout")
async def logout(current_user: RequiredUser, posthog_client: PostHogClient):
    """Logout and capture event."""
    if posthog_client:
        posthog_client.capture("user_logged_out")

    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie(key="session_token")
    return response


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    current_user: RequiredUser,
    posthog_client: PostHogClient,
):
    """Dashboard with feature flag demonstration."""
    user_id = str(current_user.id)

    if posthog_client:
        posthog_client.capture(
            "dashboard_viewed",
            properties={"is_staff": current_user.is_staff},
        )
        show_new_feature = posthog_client.feature_enabled(
            "new-dashboard-feature",
            user_id,
            person_properties={
                "email": current_user.email,
                "is_staff": current_user.is_staff,
            },
        )
        feature_config = posthog_client.get_feature_flag_payload(
            "new-dashboard-feature", user_id
        )
    else:
        show_new_feature = False
        feature_config = None

    return templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "current_user": current_user,
            "show_new_feature": show_new_feature,
            "feature_config": feature_config,
        },
    )


@router.get("/burrito", response_class=HTMLResponse)
async def burrito(
    request: Request,
    current_user: RequiredUser,
    burrito_count: Annotated[int, Cookie()] = 0,
):
    """Burrito consideration tracker page."""
    return templates.TemplateResponse(
        request,
        "burrito.html",
        {"current_user": current_user, "burrito_count": burrito_count},
    )


@router.get("/profile", response_class=HTMLResponse)
async def profile(
    request: Request,
    current_user: RequiredUser,
    posthog_client: PostHogClient,
):
    """User profile page."""
    if posthog_client:
        posthog_client.capture("profile_viewed")

    return templates.TemplateResponse(
        request, "profile.html", {"current_user": current_user}
    )


@router.post("/profile", response_class=HTMLResponse)
async def update_profile(
    request: Request,
    db: DbSession,
    current_user: RequiredUser,
    posthog_client: PostHogClient,
    name: Annotated[str, Form()] = "",
):
    """Handle profile update."""
    fields_changed = current_user.update_profile(db, name=name)

    if fields_changed and posthog_client:
        # Update PII on the person profile via set() and keep email and name out of event properties.
        posthog_client.set(
            distinct_id=str(current_user.id),
            properties={"name": current_user.name},
        )
        posthog_client.capture(
            "profile_updated",
            properties={
                "fields_changed": fields_changed,
            },
        )

    return templates.TemplateResponse(
        request,
        "profile.html",
        {
            "current_user": current_user,
            "success": "Profile updated" if fields_changed else None,
        },
    )
