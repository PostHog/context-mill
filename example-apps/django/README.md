# PostHog Django example

This is a [Django](https://djangoproject.com) example demonstrating PostHog integration with product analytics, error tracking, feature flags, and user identification.

## Features

- **Product analytics**: Track user events and behaviors
- **Error tracking**: Capture and track unhandled and handled exceptions
- **User identification**: Associate events with authenticated users via request context and auth signals
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Server-side tracking**: All tracking happens server-side with an instance-based `Posthog` client
- **Context middleware**: Automatic session and user context extraction

## Getting started

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the root directory and fill in your PostHog project token:

```bash
cp .env.example .env
```

```bash
POSTHOG_PROJECT_TOKEN=
POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings). If `POSTHOG_PROJECT_TOKEN` is left unset, the app skips PostHog initialization cleanly and logs a development warning instead of failing on startup.

### 3. Run migrations

```bash
python manage.py migrate
```

### 4. Run the development server

```bash
python manage.py runserver
```

Open [http://localhost:8000](http://localhost:8000) with your browser to see the app.

## Project structure

```
django/
├── manage.py                    # Django management script
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variable template
├── .gitignore
├── posthog_example/
│   ├── __init__.py
│   ├── settings.py              # Django settings and POSTHOG_MW_CLIENT setup
│   ├── urls.py                  # URL routing
│   ├── wsgi.py                  # WSGI application
│   └── asgi.py                  # ASGI application
└── core/
    ├── __init__.py
    ├── apps.py                  # AppConfig wiring auth signals
    ├── signals.py               # user_logged_in signal for context identity
    ├── views.py                 # Views with event tracking examples
    ├── urls.py                  # App URL patterns
    └── templates/
        └── core/
            ├── base.html        # Base template
            ├── home.html        # Home and login page
            ├── burrito.html     # Burrito page with event tracking
            ├── dashboard.html   # Dashboard with feature flag example
            └── profile.html     # Profile page
```

## Key integration points

### Django settings configuration (`posthog_example/settings.py`)

```python
import atexit
import logging
import os
from posthog import Posthog

logger = logging.getLogger(__name__)

# Leave the token as None when unset rather than defaulting to a placeholder key.
POSTHOG_PROJECT_TOKEN = os.environ.get('POSTHOG_PROJECT_TOKEN')
POSTHOG_HOST = os.environ.get('POSTHOG_HOST', 'https://us.i.posthog.com')
POSTHOG_DISABLED = os.environ.get('POSTHOG_DISABLED', 'False').lower() == 'true'

_posthog_token = (POSTHOG_PROJECT_TOKEN or '').strip()
if not POSTHOG_DISABLED and _posthog_token:
    POSTHOG_MW_CLIENT = Posthog(
        _posthog_token,
        host=POSTHOG_HOST,
        enable_exception_autocapture=True,
        debug=DEBUG,
    )
    atexit.register(POSTHOG_MW_CLIENT.shutdown)
else:
    POSTHOG_MW_CLIENT = None
    if DEBUG and not POSTHOG_DISABLED:
        logger.warning(
            'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, '
            'this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
        )

MIDDLEWARE = [
    # ... other middleware including AuthenticationMiddleware
]

if POSTHOG_MW_CLIENT is not None:
    MIDDLEWARE.append('posthog.integrations.django.PosthogContextMiddleware')
```

### Built-in context middleware

`PosthogContextMiddleware` wraps each request in a PostHog context and captures unhandled view exceptions using `POSTHOG_MW_CLIENT`. It extracts:

- **Session ID** from the `X-POSTHOG-SESSION-ID` header
- **Distinct ID** from the `X-POSTHOG-DISTINCT-ID` header or `str(request.user.pk)` when authenticated
- **Current URL** as `$current_url`
- **Request method** as `$request_method`

### Login signal identification (`core/signals.py`)

Because the middleware reads `request.user` before the view runs, a login POST starts out unauthenticated. Hooking `user_logged_in` updates the active request context and sets person properties via `client.set()` without putting PII on event properties:

```python
from django.conf import settings
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from posthog import identify_context

@receiver(user_logged_in)
def identify_posthog_user(sender, request, user, **kwargs):
    if user is None or user.pk is None:
        return

    user_id = str(user.pk)
    identify_context(user_id)

    client = settings.POSTHOG_MW_CLIENT
    if client:
        client.set(
            distinct_id=user_id,
            properties={
                'email': user.email,
                'username': user.username,
                'is_staff': user.is_staff,
            },
        )
```

### Event tracking (`core/views.py`)

In authenticated views, the middleware has already identified the context with `request.user.pk`, so `client.capture()` needs no manual wrapper or fallback ID:

```python
from django.conf import settings
from django.contrib.auth.decorators import login_required

@login_required
def consider_burrito_view(request):
    count = request.session.get('burrito_count', 0) + 1
    request.session['burrito_count'] = count

    client = settings.POSTHOG_MW_CLIENT
    if client:
        client.capture('burrito_considered', properties={
            'total_considerations': count,
        })
```

### Feature flags (`core/views.py`)

```python
from django.conf import settings
from django.contrib.auth.decorators import login_required

@login_required
def dashboard_view(request):
    user_id = str(request.user.pk)
    client = settings.POSTHOG_MW_CLIENT

    show_new_feature = (
        client.feature_enabled(
            'new-dashboard-feature',
            distinct_id=user_id,
            person_properties={
                'email': request.user.email,
                'is_staff': request.user.is_staff,
            },
        )
        if client
        else False
    )

    return render(request, 'core/dashboard.html', {
        'show_new_feature': show_new_feature,
    })
```

### Error tracking (`core/views.py`)

Unhandled view exceptions are captured automatically by `PosthogContextMiddleware`. Handled exceptions can also be captured manually:

```python
from django.conf import settings

def trigger_error_view(request):
    try:
        risky_operation()
    except Exception as e:
        client = settings.POSTHOG_MW_CLIENT
        if client:
            client.capture_exception(e)
```

## Frontend integration (optional)

If you also initialize `posthog-js` in the browser, configure `tracing_headers` with your backend hostname so `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` are sent on requests:

```javascript
if (posthogProjectToken) {
    posthog.init(posthogProjectToken, {
        api_host: 'https://us.i.posthog.com',
        tracing_headers: [window.location.hostname],
    })
}
```

## Learn more

- [PostHog Django integration](https://posthog.com/docs/libraries/django)
- [PostHog Python SDK](https://posthog.com/docs/libraries/python)
- [PostHog documentation](https://posthog.com/docs)
- [Django documentation](https://docs.djangoproject.com/)
