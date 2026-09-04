"""Fixtures for the example's tests.

The environment is set before importing the app. Settings are cached with
lru_cache and the database engine, the session serializer and the PostHog
config are all built at import time, so a later override has no effect.
"""

import os
import tempfile
from pathlib import Path

import pytest

_db_file = Path(tempfile.gettempdir()) / "posthog-fastapi-example-test.sqlite3"
_db_file.unlink(missing_ok=True)

os.environ["DATABASE_URL"] = f"sqlite:///{_db_file}"
os.environ["POSTHOG_PROJECT_TOKEN"] = "phc_test_token"
os.environ["SECRET_KEY"] = "test-secret-key"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin"


@pytest.fixture(autouse=True)
def posthog_calls(monkeypatch):
    """Record PostHog calls instead of sending them.

    Autouse so no test can reach the network. The routers bind `capture` at
    import time, so it is patched where it is used rather than on the posthog
    module. `capture_exception` and `flush` are read off the module, so those
    are patched there.
    """
    calls = {"events": [], "exceptions": [], "flushed": False}

    def capture(event, **kwargs):
        calls["events"].append((event, kwargs))

    def capture_exception(exc, **kwargs):
        calls["exceptions"].append(exc)
        return "test-event-id"

    def flush():
        calls["flushed"] = True

    monkeypatch.setattr("app.routers.api.capture", capture)
    monkeypatch.setattr("app.routers.main.capture", capture)
    monkeypatch.setattr("posthog.capture_exception", capture_exception)
    monkeypatch.setattr("posthog.flush", flush)

    return calls


@pytest.fixture
def client():
    """Client that runs the lifespan, so PostHog is configured and the DB seeded."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def logged_in_client(client):
    """Client holding a session cookie for the seeded admin user."""
    response = client.post(
        "/",
        data={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        follow_redirects=False,
    )
    assert response.status_code == 302
    return client
