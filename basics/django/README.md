# PostHog Django example

This is a [Django](https://djangoproject.com) example demonstrating PostHog integration with product analytics, error tracking, feature flags, and user identification.

## Features

- **Product analytics**: Track user events and behaviors
- **Error tracking**: Capture and track exceptions automatically
- **User identification**: Associate events with authenticated users via context
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Server-side tracking**: All tracking happens server-side with the Python SDK
- **Context middleware**: Automatic session and user context extraction

## Getting started

### 1. Install dependencies

```bash
pip install posthog
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```bash
POSTHOG_API_KEY=your_posthog_project_api_key
POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

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
│   ├── settings.py              # Django settings with PostHog config
│   ├── urls.py                  # URL routing
│   ├── wsgi.py                  # WSGI application
│   └── asgi.py                  # ASGI application
└── core/
    ├── __init__.py
    ├── apps.py                  # AppConfig with PostHog initialization
    ├── views.py                 # Views with event tracking examples
    ├── urls.py                  # App URL patterns
    └── templates/
        └── core/
            ├── base.html        # Base template
            ├── home.html        # Home/login page
            ├── burrito.html     # Burrito page with event tracking
            ├── dashboard.html   # Dashboard with feature flag example
            └── profile.html     # Profile page
```

## Key integration points

### PostHog initialization (core/apps.py)

```python
import posthog
from django.conf import settings

class CoreConfig(AppConfig):
    name = 'core'

    def ready(self):
        posthog.api_key = settings.POSTHOG_API_KEY
        posthog.host = settings.POSTHOG_HOST
```

### Django settings configuration (settings.py)

```python
import os

# PostHog configuration
POSTHOG_API_KEY = os.environ.get('POSTHOG_API_KEY', '<ph_project_api_key>')
POSTHOG_HOST = os.environ.get('POSTHOG_HOST', 'https://us.i.posthog.com')

MIDDLEWARE = [
    # ... other middleware
    'posthog.integrations.django.PosthogContextMiddleware',
]
```

### Built-in context middleware

The PostHog SDK includes a Django middleware that automatically wraps all requests with a context. It extracts session and user information from request headers and tags all events captured during the request.

The middleware automatically extracts:

- **Session ID** from the `X-POSTHOG-SESSION-ID` header
- **Distinct ID** from the `X-POSTHOG-DISTINCT-ID` header
- **Current URL** as `$current_url`
- **Request method** as `$request_method`

### User identification (core/views.py)

```python
import posthog

def login_view(request):
    # ... authentication logic
    if user:
        with posthog.new_context():
            posthog.identify_context(str(user.id))
            posthog.tag('email', user.email)
            posthog.tag('username', user.username)
            posthog.capture('user_logged_in', properties={
                'login_method': 'email',
            })
```

### Event tracking (core/views.py)

```python
import posthog

def consider_burrito(request):
    user_id = str(request.user.id) if request.user.is_authenticated else 'anonymous'

    with posthog.new_context():
        posthog.identify_context(user_id)
        posthog.capture('burrito_considered', properties={
            'total_considerations': request.session.get('burrito_count', 0),
        })
```

### Feature flags (core/views.py)

```python
import posthog

def dashboard_view(request):
    user_id = str(request.user.id) if request.user.is_authenticated else 'anonymous'

    show_new_feature = posthog.feature_enabled(
        'new-dashboard-feature',
        distinct_id=user_id
    )

    return render(request, 'core/dashboard.html', {
        'show_new_feature': show_new_feature
    })
```

### Error tracking (core/views.py)

Capture exceptions manually using `capture_exception()`:

```python
import posthog

def profile_view(request):
    try:
        risky_operation()
    except Exception as e:
        posthog.capture_exception(e)
```

## Frontend integration (optional)

If you're using PostHog's JavaScript SDK on the frontend, enable tracing headers to connect frontend sessions with backend events:

```javascript
posthog.init('<ph_project_api_key>', {
    api_host: 'https://us.i.posthog.com',
    __add_tracing_headers: ['your-backend-domain.com'],
})
```

This automatically adds `X-POSTHOG-SESSION-ID` and `X-POSTHOG-DISTINCT-ID` headers to requests, which the Django middleware extracts to maintain context.

## Learn more

- [PostHog Django integration](https://posthog.com/docs/libraries/django)
- [PostHog Python SDK](https://posthog.com/docs/libraries/python)
- [PostHog documentation](https://posthog.com/docs)
- [Django documentation](https://docs.djangoproject.com/)
