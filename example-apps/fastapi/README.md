# PostHog FastAPI Example

A FastAPI application demonstrating PostHog integration for analytics, feature flags, and error tracking.

## Features

- User registration and authentication with cookie-based sessions
- SQLite database persistence with SQLAlchemy
- Instance-based `Posthog` client with `PosthogASGIMiddleware`
- User identification via request context and person properties via `set()`
- Custom event tracking without PII in event properties
- Feature flags with payload support
- Automatic and manual error tracking

## Quick Start

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy the environment file and configure your project token:
   ```bash
   cp .env.example .env
   # Edit .env and set POSTHOG_PROJECT_TOKEN
   ```

4. Run the application:
   ```bash
   python run.py
   ```

5. Open http://localhost:5002 and either:
   - Login with default credentials: `admin@example.com` / `admin`
   - Or click "Sign up here" to create a new account

## PostHog Integration Points

### App Initialization (`app/main.py`)

`Posthog` is constructed at app build time only when `POSTHOG_PROJECT_TOKEN` is configured, registered with `PosthogASGIMiddleware` and `atexit.register(posthog_client.shutdown)`, and flushed during lifespan shutdown:

```python
import atexit
from posthog import Posthog
from posthog.integrations.asgi import PosthogASGIMiddleware

_posthog_token = (settings.posthog_project_token or "").strip()
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

if posthog_client is not None:
    app.add_middleware(PosthogASGIMiddleware, client=posthog_client)
```

### User Registration and Login (`app/routers/main.py`)

Users are identified by their stable numeric primary key, and PII such as email stays in person properties via `set()`:

```python
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
            properties={"is_new_user": is_new_user, "login_method": "password"},
        )
```

### Event Tracking

`get_current_user` calls `identify_context(str(user.id))` inside the active ASGI middleware context, so authenticated route handlers capture directly:

```python
if posthog_client:
    posthog_client.capture(
        "burrito_considered",
        properties={"total_considerations": new_count},
    )
```

### Feature Flags

The dashboard demonstrates feature flag evaluation:

```python
if posthog_client:
    show_new_feature = posthog_client.feature_enabled(
        "new-dashboard-feature",
        str(current_user.id),
        person_properties={"email": current_user.email, "is_staff": current_user.is_staff},
    )
    feature_config = posthog_client.get_feature_flag_payload(
        "new-dashboard-feature", str(current_user.id)
    )
```

### Error Tracking

Unhandled route exceptions are captured automatically by `PosthogASGIMiddleware`. Handled exceptions in critical paths can be captured explicitly (`app/routers/api.py`):

```python
try:
    result = process_payment()
except Exception as e:
    event_id = posthog_client.capture_exception(e) if posthog_client else None
    return JSONResponse(
        {
            "error": "Operation failed",
            "error_id": event_id,
            "message": f"Error captured in PostHog. Reference ID: {event_id}",
        },
        status_code=500,
    )
```

The `/api/test-error` endpoint demonstrates manual exception capture. Use `?capture=true` to capture in PostHog, or `?capture=false` to skip tracking.

## Project Structure

```
example-apps/fastapi/
├── app/
│   ├── __init__.py              # Package marker
│   ├── config.py                # Pydantic Settings configuration
│   ├── database.py              # SQLAlchemy setup
│   ├── dependencies.py          # FastAPI dependency injection
│   ├── main.py                  # App factory, PosthogASGIMiddleware, and lifespan
│   ├── models.py                # User model (SQLAlchemy)
│   ├── routers/
│   │   ├── __init__.py          # Routers package
│   │   ├── main.py              # Page routes (HTML)
│   │   └── api.py               # API endpoints (JSON)
│   └── templates/               # Jinja2 templates
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
└── run.py                       # Entry point (uvicorn)
```
