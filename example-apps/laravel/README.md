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

- **Framework**: Laravel 12.x (PHP 8.2+)
- **Reactive Components**: Livewire 4.x
- **Database**: SQLite
- **Analytics**: PostHog Laravel SDK (`posthog/posthog-laravel`)

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
   POSTHOG_ENABLED=true
   ```
   For an EU Cloud project, use `https://eu.i.posthog.com` as the host. With a blank `POSTHOG_PROJECT_TOKEN` the app boots with PostHog disabled.

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

This example uses the [PostHog Laravel SDK](https://posthog.com/docs/libraries/laravel) (`posthog/posthog-laravel`), which requires Laravel 12 or 13. Setup is two commands plus environment variables:

```bash
composer require posthog/posthog-laravel
php artisan posthog:install
```

`posthog:install` publishes `config/posthog.php`, which reads `POSTHOG_HOST` and `POSTHOG_ENABLED`. The published file reads the token from `POSTHOG_API_KEY`; this app changes that one line to `POSTHOG_PROJECT_TOKEN`, the name PostHog uses for the project token everywhere else. Laravel's package discovery registers the service provider and the `PostHog\Laravel\Facades\PostHog` facade, so the app has no PostHog service provider, middleware, exception callback or wrapper class.

> **Laravel 11 or earlier:** the Laravel SDK does not support these versions. Use the PHP SDK (`posthog/posthog-php`) with the "Manual setup with the PHP SDK" steps on the [Laravel docs page](https://posthog.com/docs/libraries/laravel) instead. Do not combine that setup with this SDK.

## What the SDK does for you

- Events captured during a request carry the request method and matched route, and the visitor's IP as `$ip`.
- The identity is the signed-in user's auth identifier. Without a signed-in user, the SDK falls back to the `X-PostHog-Distinct-Id` header sent by posthog-js, which is client-controlled and never authentication.
- Signed-out events with no identity get a fresh random ID with `$process_person_profile` set to `false`. These IDs do not link events from the same visitor ([anonymous vs identified events](https://posthog.com/docs/data/anonymous-vs-identified-events.md)).
- Exceptions Laravel reports are captured, honoring `dontReport`.
- Events are flushed at the end of each request, queue job and Octane tick.
- A blank `POSTHOG_PROJECT_TOKEN` or `POSTHOG_ENABLED=false` turns every call into a no-op without breaking boot. Run `php artisan posthog:doctor` to check the configuration.

**Still done by the app**

- Identifying users at login and signup with a stable distinct ID (`User::getPostHogDistinctId()`, the primary key, not the email, which can change).
- Capturing events with `PostHog::capture`.
- Evaluating flags with `PostHog::evaluateFlags`.
- Capturing handled exceptions with `PostHog::captureException`.

Behind a reverse proxy or load balancer, configure Laravel's [trusted proxies](https://laravel.com/docs/requests#configuring-trusted-proxies) so `$ip` is the visitor's address. Set `POSTHOG_CAPTURE_IP=false` to turn IP collection off.

This example loads no browser SDK, so there is no `posthog-js` or reverse proxy setup here. If you add `posthog-js`, set `defaults: '2026-08-30'`, configure `tracing_headers` for this app's hostname, and see the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md).

## PostHog Integration Points

Every call uses the facade: `use PostHog\Laravel\Facades\PostHog;`.

### User Registration (`app/Http/Livewire/Auth/Register.php`)
New users are identified and tracked on signup. The distinct ID is passed explicitly so the identify and the event are tied to the same person:
```php
PostHog::identify([
    'distinctId' => $user->getPostHogDistinctId(),
    'properties' => $user->getPostHogProperties(),
]);
PostHog::capture('user_signed_up', [
    'signup_method' => 'form',
], $user->getPostHogDistinctId());
```

### User Login (`app/Http/Livewire/Auth/Login.php`)
Users are identified on login with their properties. The distinct ID is passed explicitly so the identify and the event are tied to the same person:
```php
PostHog::identify([
    'distinctId' => $user->getPostHogDistinctId(),
    'properties' => $user->getPostHogProperties(),
]);
PostHog::capture('user_logged_in', [
    'login_method' => 'password',
], $user->getPostHogDistinctId());
```

### User Logout (`routes/web.php`)
The event is captured before `Auth::logout()`, while the request still has a signed-in user:
```php
PostHog::capture('user_logged_out');
```

### Page View Tracking
Dashboard and profile views are tracked (`app/Http/Livewire/Dashboard.php`, `app/Http/Livewire/Profile.php`). No distinct ID is passed: the SDK uses the signed-in user.
```php
PostHog::capture('dashboard_viewed', [
    'is_staff' => $user->is_staff,
]);

PostHog::capture('profile_viewed');
```

### Custom Event Tracking (`app/Http/Livewire/BurritoTracker.php`)
The burrito tracker demonstrates custom event capture:
```php
PostHog::capture('burrito_considered', [
    'total_considerations' => $this->burritoCount,
]);
```

### Feature Flags (`app/Http/Livewire/Dashboard.php`)
The dashboard evaluates flags once for the signed-in user and reads from the snapshot:
```php
$flags = PostHog::evaluateFlags(personProperties: $user->getPostHogProperties());

$this->showNewFeature = $flags->isEnabled('new-dashboard-feature');
$this->featureConfig = $flags->getFlagPayload('new-dashboard-feature');
```

### Error Tracking
Manual exception capture is demonstrated in multiple places. `captureException` returns a boolean, not an event ID, so the UI does not show an error ID.

**Livewire Components** (`app/Http/Livewire/Dashboard.php`, `app/Http/Livewire/Profile.php`):
```php
try {
    throw new \Exception('This is a test error for PostHog tracking');
} catch (\Exception $e) {
    PostHog::captureException($e);
    $this->successMessage = 'Error captured in PostHog!';
}
```

**API Endpoint** (`app/Http/Controllers/Api/ErrorTestController.php`):
```php
try {
    throw new \Exception('Test exception from critical operation');
} catch (\Throwable $e) {
    if ($shouldCapture) {
        PostHog::captureException($e, properties: ['operation' => 'critical']);

        return response()->json([
            'error' => 'Operation failed',
            'message' => 'Error captured in PostHog.',
        ], 500);
    }
}
```

The `/api/test-error` endpoint demonstrates manual exception capture. Use `?capture=true` to capture in PostHog, or `?capture=false` to skip tracking. The API routes use the session guard, so call them from a signed-in browser session with a CSRF token.

Exceptions that Laravel reports on its own (uncaught ones) are captured by the SDK with no code in the app.


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
│   └── Models/
│       └── User.php                        # User model with PostHog properties
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
    └── posthog.php                         # Published by posthog:install
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