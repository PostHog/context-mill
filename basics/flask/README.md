# PostHog Flask Example

A Flask application demonstrating PostHog integration for analytics, feature flags, and error tracking.

## Features

- User registration and authentication with Flask-Login
- SQLite database persistence with Flask-SQLAlchemy
- User identification and property tracking
- Custom event tracking
- Feature flags with payload support
- Error tracking and exception capture
- Group analytics

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
Exceptions are captured for monitoring:
```python
posthog.capture_exception(exception)
```

### Group Analytics
Company-level analytics tracking:
```python
posthog.group_identify('company', 'acme-corp', {
    'name': 'Acme Corporation',
    'plan': 'enterprise'
})

with new_context():
    identify_context(current_user.email)
    capture('feature_used', properties={'feature_name': 'analytics'},
            groups={'company': 'acme-corp'})
```

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

## Key Differences from Django Version

| Aspect | Django | Flask |
|--------|--------|-------|
| Project Structure | Single app in project | Application factory + blueprints |
| Database | SQLite via Django ORM | SQLite via Flask-SQLAlchemy |
| User Model | Built-in `auth.User` model | Custom SQLAlchemy `User` model |
| User Registration | Django admin / `createsuperuser` | `/signup` route with form |
| Authentication | Django auth system | Flask-Login |
| Session Management | Django sessions | Flask sessions (cookie-based) |
| Configuration | settings.py | Config classes with app factory |
| URL Routing | urls.py patterns | Blueprint route decorators |
| PostHog Init | AppConfig.ready() | Application factory |
| Error Capture | PostHog middleware auto-captures | Requires global `@app.errorhandler(Exception)` |
