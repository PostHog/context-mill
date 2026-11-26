"""FastAPI application with PostHog integration."""

import atexit
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from posthog import Posthog
from posthog.integrations.asgi import PosthogASGIMiddleware

from app.config import get_settings
from app.database import SessionLocal, init_db
from app.models import User
from app.routers import api, main

logger = logging.getLogger(__name__)
settings = get_settings()

# Setup templates
templates_dir = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(templates_dir))

# Construct the PostHog client at app build time only when a real token is configured,
# leaving posthog_client as None instead of passing an empty or placeholder key.
_posthog_token = (settings.posthog_project_token or "").strip()
posthog_client: Optional[Posthog]
if not settings.posthog_disabled and _posthog_token:
    posthog_client = Posthog(
        _posthog_token,
        host=settings.posthog_host,
        enable_exception_autocapture=True,
        debug=settings.debug,
    )
    atexit.register(posthog_client.shutdown)
else:
    posthog_client = None
    if not settings.posthog_disabled and settings.debug:
        logger.warning(
            "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, "
            "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events for startup and shutdown."""
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

    # Flush queued events before the process exits without failing shutdown on network errors.
    if posthog_client is not None:
        try:
            posthog_client.flush()
        except Exception:
            pass


app = FastAPI(
    title="PostHog FastAPI Example",
    description="Example application demonstrating PostHog integration with FastAPI",
    lifespan=lifespan,
)
app.state.posthog = posthog_client

if posthog_client is not None:
    app.add_middleware(PosthogASGIMiddleware, client=posthog_client)

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
