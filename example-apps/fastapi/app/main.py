"""FastAPI application with PostHog integration."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

import posthog
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import get_settings
from app.database import SessionLocal, init_db
from app.middleware import PostHogMiddleware
from app.models import User
from app.routers import api, main

logger = logging.getLogger(__name__)
settings = get_settings()

# Setup templates
templates_dir = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events for startup/shutdown."""
    # Startup: Initialize PostHog
    token = settings.posthog_project_token.strip()
    is_configured = bool(token) and not token.startswith("<ph_")
    if settings.posthog_disabled or not is_configured:
        posthog.disabled = True
        if not settings.posthog_disabled and settings.debug:
            logger.warning(
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, "
                "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
            )
    else:
        posthog.disabled = False
        posthog.api_key = token
        posthog.host = settings.posthog_host
        posthog.debug = settings.debug

    # Initialize database and seed default user
    init_db()
    db = SessionLocal()
    try:
        if not User.get_by_email(db, "admin@example.com"):
            User.create_user(
                db,
                email="admin@example.com",
                password="admin",
                is_staff=True,
            )
    finally:
        db.close()

    yield

    # Shutdown: Flush PostHog events
    if not posthog.disabled:
        posthog.flush()


app = FastAPI(
    title="PostHog FastAPI Example",
    description="Example application demonstrating PostHog integration with FastAPI",
    lifespan=lifespan,
)

app.add_middleware(PostHogMiddleware)

# Include routers
app.include_router(main.router)
app.include_router(api.router, prefix="/api")


# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Handle 404 errors."""
    if request.url.path.startswith("/api/"):
        return JSONResponse({"error": "Not found"}, status_code=404)
    return templates.TemplateResponse(
        request, "errors/404.html", status_code=404
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """Handle 500 errors."""
    if request.url.path.startswith("/api/"):
        return JSONResponse({"error": "Internal server error"}, status_code=500)
    return templates.TemplateResponse(
        request, "errors/500.html", status_code=500
    )
