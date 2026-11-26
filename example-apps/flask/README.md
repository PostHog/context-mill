# PostHog Flask Example

A Flask application demonstrating PostHog integration for analytics, feature flags, and error tracking.

## Features

- User registration and authentication with Flask-Login
- SQLite database persistence with Flask-SQLAlchemy
- Instance-based `Posthog` client registered via `PosthogFlaskIntegration`
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

5. Open http://localhost:5001 and either:
   - Login with default credentials: `admin@example.com` / `admin`
   - Or click "Sign up here" to create a new account

## PostHog Integration Points

### Application Factory (`app/__init__.py`)

`Posthog` and `PosthogFlaskIntegration` are initialized once in `create_app()` before blueprint registration when `POSTHOG_PROJECT_TOKEN` is configured:

```python
import atexit
from posthog import Posthog, identify_context
from posthog.integrations.flask import PosthogFlaskIntegration

token = (app.config.get("POSTHOG_PROJECT_TOKEN") or "").strip()
if not app.config["POSTHOG_DISABLED"] and token:
    posthog_client = Posthog(
        token,
        host=app.config["POSTHOG_HOST"],
        enable_exception_autocapture=True,
        debug=app.config["DEBUG"],
    )
    PosthogFlaskIntegration(app, client=posthog_client)
    atexit.register(posthog_client.shutdown)
    app.extensions["posthog"] = posthog_client
else:
    app.extensions["posthog"] = None
```

### User Registration and Login (`app/main/routes.py`)

Users are identified by their stable numeric primary key, and PII such as email stays in person properties via `set()`:

```python
posthog_client = current_app.extensions.get("posthog")
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
        posthog_client.capture("user_logged_in", properties={"login_method": "password"})
```

### Event Tracking

Custom events are captured using the shared `Posthog` client:

```python
posthog_client = current_app.extensions.get("posthog")
if posthog_client:
    identify_context(str(current_user.id))
    posthog_client.capture(
        "burrito_considered",
        properties={"total_considerations": burrito_count},
    )
```

### Feature Flags

The dashboard demonstrates feature flag evaluation:

```python
posthog_client = current_app.extensions.get("posthog")
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

Unhandled route exceptions are captured automatically by `PosthogFlaskIntegration`. Handled exceptions in critical operations can also be captured explicitly (`app/api/routes.py`):

```python
try:
    result = process_payment()
except Exception as e:
    posthog_client = current_app.extensions.get("posthog")
    if posthog_client:
        identify_context(str(current_user.id))
        event_id = posthog_client.capture_exception(e)
    else:
        event_id = None

    return jsonify(
        {
            "error": "Operation failed",
            "error_id": event_id,
            "message": f"Error captured in PostHog. Reference ID: {event_id}",
        }
    ), 500
```

The `/api/test-error` and `/api/trigger-error` endpoints demonstrate manual exception capture.

## Project Structure

```
example-apps/flask/
├── app/
│   ├── __init__.py              # Application factory and PosthogFlaskIntegration
│   ├── config.py                # Configuration classes
│   ├── extensions.py            # Extension instances
│   ├── models.py                # User model (SQLAlchemy)
│   ├── main/
│   │   ├── __init__.py          # Main blueprint
│   │   └── routes.py            # View functions
│   ├── templates/               # HTML templates
│   └── api/
│       ├── __init__.py          # API blueprint
│       └── routes.py            # API endpoints
├── .env.example
├── .gitignore
├── requirements.txt
├── README.md
└── run.py                       # Entry point
```
