"""Main routes demonstrating PostHog integration patterns."""

from pathlib import Path
from typing import Annotated

import posthog
from fastapi import APIRouter, Cookie, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from posthog import capture

from app.dependencies import (
    CurrentUser,
    DbSession,
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
    """Home/login page."""
    if current_user:
        return RedirectResponse(url="/dashboard", status_code=302)

    return templates.TemplateResponse(
        request, "home.html", {"current_user": current_user}
    )


@router.post("/", response_class=HTMLResponse)
async def login(
    request: Request,
    db: DbSession,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
):
    """Handle login form submission."""
    user = User.authenticate(db, email, password)

    if user:
        posthog.identify(user.email, {"email": user.email, "is_staff": user.is_staff})
        posthog.capture(user.email, "user_logged_in", properties={"login_method": "password"})

        # Create session and redirect
        response = RedirectResponse(url="/dashboard", status_code=302)
        response.set_cookie(
            key="session_token",
            value=create_session_token(user.id),
            httponly=True,
            samesite="lax",
        )
        return response

    # Login failed
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
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    password_confirm: Annotated[str, Form()],
):
    """Handle signup form submission."""
    error = None

    if not email or not password:
        error = "Email and password are required"
    elif password != password_confirm:
        error = "Passwords do not match"
    elif User.get_by_email(db, email):
        error = "Email already registered"

    if error:
        return templates.TemplateResponse(
            request, "signup.html", {"current_user": None, "error": error}
        )

    # Create new user
    user = User.create_user(db, email=email, password=password, is_staff=False)

    posthog.identify(user.email, {"email": user.email, "is_staff": user.is_staff})
    posthog.capture(user.email, "user_signed_up", properties={"signup_method": "form"})

    # Create session and redirect
    response = RedirectResponse(url="/dashboard", status_code=302)
    response.set_cookie(
        key="session_token",
        value=create_session_token(user.id),
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/logout")
async def logout(current_user: RequiredUser):
    """Logout and capture event."""
    capture("user_logged_out")

    response = RedirectResponse(url="/", status_code=302)
    response.delete_cookie(key="session_token")
    return response


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(
    request: Request,
    current_user: RequiredUser,
):
    """Dashboard with feature flag demonstration."""
    capture("dashboard_viewed", properties={"is_staff": current_user.is_staff})

    # Check feature flag
    show_new_feature = posthog.feature_enabled(
        "new-dashboard-feature",
        current_user.email,
        person_properties={
            "email": current_user.email,
            "is_staff": current_user.is_staff,
        },
    )

    # Get feature flag payload
    feature_config = posthog.get_feature_flag_payload(
        "new-dashboard-feature", current_user.email
    )

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
async def profile(request: Request, current_user: RequiredUser):
    """User profile page."""
    capture("profile_viewed")

    return templates.TemplateResponse(
        request, "profile.html", {"current_user": current_user}
    )
