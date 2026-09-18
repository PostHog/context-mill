"""PostHog is configured on startup and flushed on shutdown."""

import posthog
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app


def test_lifespan_configures_the_client(client):
    settings = get_settings()

    assert posthog.api_key == settings.posthog_project_token
    assert posthog.host == settings.posthog_host


def test_lifespan_flushes_pending_events_on_shutdown(posthog_calls):
    with TestClient(app):
        assert posthog_calls["flushed"] is False

    assert posthog_calls["flushed"] is True


def test_lifespan_seeds_the_default_user(client):
    response = client.post(
        "/",
        data={"email": "admin@example.com", "password": "admin"},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"] == "/dashboard"
