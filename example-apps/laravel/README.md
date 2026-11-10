# PostHog Laravel Example

A Laravel application demonstrating PostHog integration for analytics, feature flags, and error tracking using Livewire for reactive UI components.

## Features

- User registration and authentication with Livewire
- SQLite database persistence with Eloquent ORM
- User identification and property tracking
- Custom event tracking (burrito consideration tracker)
- Page view tracking (dashboard, profile)
- Feature flags with payload support (`evaluateFlags`)
- Error tracking with manual exception capture
- Reactive UI components with Livewire

## Tech Stack

- **Framework**: Laravel 11.x
- **Reactive Components**: Livewire 3.x
- **Database**: SQLite
- **Analytics**: PostHog PHP SDK (`posthog/posthog-php`)

## Quick Start

**Note**: This is a minimal implementation demonstrating PostHog integration. For a production application, you would need to install Laravel via Composer and set up additional dependencies.

### Manual Setup (Demonstration)

1. Install dependencies:
   ```bash
   composer install
   ```

2. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your PostHog project token
   ```

3. Configure PostHog in `.env`:
   ```env
   POSTHOG_PROJECT_TOKEN=phc_your_project_token
   POSTHOG_HOST=https://us.i.posthog.com
   POSTHOG_DISABLED=false
   ```

4. Generate application key:
   ```bash
   php artisan key:generate
   ```

5. Create database and run migrations:
   ```bash
   touch database/database.sqlite
   php artisan migrate --seed
   ```

6. Start the development server:
   ```bash
   php artisan serve
   ```

7. Open http://localhost:8000 and either:
   - Login with default credentials: `admin@example.com` / `admin`
   - Or click "Sign up here" to create a new account

## How PostHog is wired in

This example uses the PostHog PHP SDK directly, the setup the [Laravel docs](https://posthog.com/docs/libraries/laravel) describe as "Manual setup with the PHP SDK". PostHog also publishes an experimental Laravel SDK (`posthog/posthog-laravel`, Laravel 12 and 13) that does the three steps below for you. Do not combine it with this setup.

| Concern | Where | What it does |
|--------|-------|--------------|
| Client init | `app/Providers/AppServiceProvider.php` | Calls `PostHog::init` once in `boot()` when `config('posthog.enabled')` is true. Registered in `bootstrap/providers.php`. |
| Configuration | `config/posthog.php` | Reads `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`, `POSTHOG_DISABLED`. `enabled` is true only with a token and without `POSTHOG_DISABLED=true`. |
| Request context | `app/Http/Middleware/PostHogRequestContext.php`, registered in `bootstrap/app.php` | Wraps each request in `PostHog::withContext` with request metadata and the `X-PostHog-Distinct-Id` / `X-PostHog-Session-Id` headers. |
| Exception capture | `bootstrap/app.php` (`$exceptions->report`) | Sends exceptions Laravel reports to PostHog, honouring `dontReport`. |
| Calls from app code | `app/Services/PostHogService.php` | Thin wrapper that skips calls while PostHog is disabled. |

## What the integration sets up for you

Stated from the PHP and Laravel docs and the posthog-php source.

**Automatic once the pieces above are in place**

- Events captured during a request carry `$current_url`, `$request_method`, `$request_path`, `$user_agent` and `$ip`, because the middleware adds them.
- The tracing headers sent by posthog-js become the default distinct ID and session ID (`PostHog::contextFromHeaders`). These headers are client-controlled; the app passes the authenticated user's ID explicitly instead.
- Exceptions Laravel reports are captured, with the signed-in user's ID.
- Queued events flush when the client is destroyed at the end of a normal PHP request.

**Still done by the app**

- Calling `PostHog::init` (the service provider) and registering the middleware and report callback in `bootstrap/app.php`.
- Identifying users at login and signup, and choosing the distinct ID (`User::getPostHogDistinctId()`, the primary key).
- Capturing events with `capture`.
- Evaluating flags with `evaluateFlags`.
- Flushing in long-running processes (queue workers, Horizon, Octane): call `PostHog::flush()` there. This example runs none.
- A missing token: the app boots, PostHog stays disabled, and local development logs a warning naming `POSTHOG_PROJECT_TOKEN`.

This example loads no browser SDK, so there is no `posthog-js` or reverse proxy setup here. If you add `posthog-js`, set `defaults: '2026-08-30'`, configure `tracing_headers` for this app's hostname, and see the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md).

### Distinct IDs and signed-out visitors

Signed-in users are identified by their stable primary key. Never use a shared literal such as `"anonymous"`: PostHog would merge every signed-out visitor into one person. For a signed-out visitor, `PostHogService::currentDistinctId()` generates a random UUID, keeps it in the session (`posthog_visitor_id`) so it is reused for the visit, and exceptions captured for that visitor set `$process_person_profile` to `false` ([anonymous vs identified events](https://posthog.com/docs/data/anonymous-vs-identified-events.md)). Use the same ID when checking feature flags for that visitor. Every route in this example requires a login, so only exception capture reaches the signed-out path.

## PostHog Service

`PostHogService` (`app/Services/PostHogService.php`) wraps the SDK:

| Method | Description |
|--------|-------------|
| `identify($distinctId, $properties)` | Identify a user with properties |
| `capture($distinctId, $event, $properties)` | Capture custom events |
| `captureException($exception, $distinctId, $properties)` | Capture exceptions; defaults to the current user or visitor |
| `currentDistinctId()` | Signed-in user ID, or the session's visitor UUID |
| `evaluateFlags($distinctId, $personProperties)` | Evaluate all flags once; returns a snapshot (`isEnabled`, `getFlag`, `getFlagPayload`) or null while disabled |

All methods return early when `config('posthog.enabled')` is false.

## PostHog Integration Points

### User Registration (`app/Http/Livewire/Auth/Register.php`)
New users are identified and tracked on signup:
```php
$posthog->identify($user->getPostHogDistinctId(), $user->getPostHogProperties());
$posthog->capture($user->getPostHogDistinctId(), 'user_signed_up', [
    'signup_method' => 'form',
]);
```

### User Login (`app/Http/Livewire/Auth/Login.php`)
Users are identified on login with their properties:
```php
$posthog->identify($user->getPostHogDistinctId(), $user->getPostHogProperties());
$posthog->capture($user->getPostHogDistinctId(), 'user_logged_in', [
    'login_method' => 'password',
]);
```

### User Logout (`routes/web.php`)
Logout events are tracked:
```php
$posthog->capture($user->getPostHogDistinctId(), 'user_logged_out');
```

### Page View Tracking
Dashboard and profile views are tracked (`app/Http/Livewire/Dashboard.php`, `app/Http/Livewire/Profile.php`):
```php
$posthog->capture($user->getPostHogDistinctId(), 'dashboard_viewed', [
    'is_staff' => $user->is_staff,
]);

$posthog->capture($user->getPostHogDistinctId(), 'profile_viewed');
```

### Custom Event Tracking (`app/Http/Livewire/BurritoTracker.php`)
The burrito tracker demonstrates custom event capture:
```php
$posthog->identify($user->getPostHogDistinctId(), $user->getPostHogProperties());
$posthog->capture($user->getPostHogDistinctId(), 'burrito_considered', [
    'total_considerations' => $this->burritoCount,
]);
```

### Feature Flags (`app/Http/Livewire/Dashboard.php`)
The dashboard evaluates flags once and reads from the snapshot:
```php
$flags = $posthog->evaluateFlags(
    $user->getPostHogDistinctId(),
    $user->getPostHogProperties()
);

$this->showNewFeature = $flags?->isEnabled('new-dashboard-feature') ?? false;
$this->featureConfig = $flags?->getFlagPayload('new-dashboard-feature');
```

### Error Tracking
Manual exception capture is demonstrated in multiple places:

**Livewire Components** (`app/Http/Livewire/Dashboard.php`, `app/Http/Livewire/Profile.php`):
```php
try {
    throw new \Exception('This is a test error for PostHog tracking');
} catch (\Exception $e) {
    $errorId = $posthog->captureException($e, $user->getPostHogDistinctId());
    $this->successMessage = "Error captured in PostHog! Error ID: {$errorId}";
}
```

**API Endpoint** (`app/Http/Controllers/Api/ErrorTestController.php`):
```php
try {
    throw new \Exception('Test exception from critical operation');
} catch (\Throwable $e) {
    if ($shouldCapture) {
        $posthog->identify($user->getPostHogDistinctId(), $user->getPostHogProperties());
        $eventId = $posthog->captureException($e, $user->getPostHogDistinctId());

        return response()->json([
            'error' => 'Operation failed',
            'error_id' => $eventId,
            'message' => "Error captured in PostHog. Reference ID: {$eventId}",
        ], 500);
    }
}
```

The `/api/test-error` endpoint demonstrates manual exception capture. Use `?capture=true` to capture in PostHog, or `?capture=false` to skip tracking.


## Pages

| Route | Component | PostHog Events |
|-------|-----------|----------------|
| `/` | Login | `user_logged_in` |
| `/register` | Register | `user_signed_up` |
| `/dashboard` | Dashboard | `dashboard_viewed`, feature flag checks |
| `/burrito` | BurritoTracker | `burrito_considered` |
| `/profile` | Profile | `profile_viewed` |
| `/logout` | (route) | `user_logged_out` |

## Project Structure

```
example-apps/laravel/
├── app/
│   ├── Http/
│   │   ├── Middleware/
│   │   │   └── PostHogRequestContext.php   # Request context for events
│   │   ├── Controllers/
│   │   │   └── Api/
│   │   │       ├── BurritoController.php   # Burrito API endpoint
│   │   │       └── ErrorTestController.php # Error testing endpoint
│   │   └── Livewire/
│   │       ├── Auth/
│   │       │   ├── Login.php               # Login component
│   │       │   └── Register.php            # Registration component
│   │       ├── BurritoTracker.php          # Burrito tracker component
│   │       ├── Dashboard.php               # Dashboard with feature flags
│   │       └── Profile.php                 # User profile component
│   ├── Models/
│   │   └── User.php                        # User model with PostHog properties
│   ├── Providers/
│   │   └── AppServiceProvider.php          # PostHog::init
│   └── Services/
│       └── PostHogService.php              # PostHog wrapper service
├── database/
│   ├── migrations/                         # Database migrations
│   └── seeders/
│       └── DatabaseSeeder.php              # Seeds admin user
├── resources/
│   └── views/
│       ├── components/
│       │   └── layouts/
│       │       ├── app.blade.php           # Authenticated layout
│       │       └── guest.blade.php         # Guest layout
│       ├── errors/
│       │   ├── 404.blade.php               # Not found page
│       │   └── 500.blade.php               # Server error page
│       └── livewire/
│           ├── auth/
│           │   ├── login.blade.php         # Login form
│           │   └── register.blade.php      # Registration form
│           ├── burrito-tracker.blade.php   # Burrito tracker UI
│           ├── dashboard.blade.php         # Dashboard UI
│           └── profile.blade.php           # Profile UI
├── routes/
│   ├── web.php                             # Web routes (auth, pages)
│   └── api.php                             # API routes
└── config/
    └── posthog.php                         # PostHog configuration
```

## Development Commands

```bash
# Start development server
php artisan serve

# Run migrations
php artisan migrate

# Seed database
php artisan migrate:fresh --seed

# Clear caches
php artisan optimize:clear
```