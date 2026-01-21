# PostHog Flask Example

A Flask application demonstrating PostHog integration for analytics, feature flags, and error tracking.

## Features

- User registration and authentication with Flask-Login
- SQLite database persistence with Flask-SQLAlchemy
- User identification and property tracking
- Custom event tracking
- Feature flags with payload support
- Error tracking with manual exception capture

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

3. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your PostHog project key
   ```

4. Run the application:
   ```bash
   python run.py
   ```

5. Open http://localhost:5001 and either:
   - Login with default credentials: `admin@example.com` / `admin`
   - Or click "Sign up here" to create a new account

## PostHog Integration Points

### User Registration
New users are identified and tracked on signup using the context-based API:
```python
with new_context():
    identify_context(user.email)
    tag('email', user.email)
    tag('is_staff', user.is_staff)
    capture('user_signed_up', properties={'signup_method': 'form'})
```

### User Identification
Users are identified on login with their properties:
```python
with new_context():
    identify_context(user.email)
    tag('email', user.email)
    tag('is_staff', user.is_staff)
    capture('user_logged_in', properties={'login_method': 'password'})
```

### Event Tracking
Custom events are captured throughout the app:
```python
with new_context():
    identify_context(current_user.email)
    capture('burrito_considered', properties={'total_considerations': count})
```

### Feature Flags
The dashboard demonstrates feature flag checking:
```python
show_new_feature = posthog.feature_enabled(
    'new-dashboard-feature',
    current_user.email,
    person_properties={'email': current_user.email, 'is_staff': current_user.is_staff}
)
feature_config = posthog.get_feature_flag_payload('new-dashboard-feature', current_user.email)
```

### Error Tracking

The example demonstrates two approaches to error tracking:

Manual capture for specific critical operations** (`app/api/routes.py`).

```python
try:
    # Critical operation that might fail
    result = process_payment()
except Exception as e:
    # Manually capture this specific exception
    with new_context():
        identify_context(current_user.email)
        event_id = posthog.capture_exception(e)

    return jsonify({
        "error": "Operation failed",
        "error_id": event_id,
        "message": f"Error captured in PostHog. Reference ID: {event_id}"
    }), 500
```

The `/api/test-error` endpoint demonstrates manual exception capture. Use `?capture=true` to capture in PostHog, or `?capture=false` to skip tracking.

## Project Structure

```
basics/flask/
├── app/
│   ├── __init__.py              # Application factory
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
