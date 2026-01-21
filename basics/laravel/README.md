# PostHog Laravel Example

A Laravel application demonstrating PostHog integration for analytics, feature flags, and error tracking using Livewire for reactive UI components.

## Features

- User registration and authentication with Livewire
- SQLite database persistence with Eloquent ORM
- User identification and property tracking
- Custom event tracking (burrito consideration tracker)
- Page view tracking (dashboard, profile)
- Feature flags with payload support
- Error tracking with manual exception capture
- Reactive UI components with Livewire

## Tech Stack

- **Framework**: Laravel 11.x
- **Reactive Components**: Livewire 3.x
- **Database**: SQLite
- **Analytics**: PostHog PHP SDK

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
   # Edit .env with your PostHog API key
   ```

3. Configure PostHog in `.env`:
   ```env
   POSTHOG_API_KEY=your_posthog_api_key
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

## PostHog Service

The `PostHogService` class (`app/Services/PostHogService.php`) wraps the PostHog PHP SDK and provides:

| Method | Description |
|--------|-------------|
| `identify($distinctId, $properties)` | Identify a user with properties |
| `capture($distinctId, $event, $properties)` | Capture custom events |
| `captureException($exception, $distinctId)` | Capture exceptions with stack traces |
| `isFeatureEnabled($key, $distinctId, $properties)` | Check feature flag status |
| `getFeatureFlagPayload($key, $distinctId)` | Get feature flag payload |

All methods check `config('posthog.disabled')` and return early if PostHog is disabled.

## PostHog Integration Points

### User Registration (`app/Http/Livewire/Auth/Register.php`)
New users are identified and tracked on signup:
```php
$posthog->identify($user->email, $user->getPostHogProperties());
$posthog->capture($user->email, 'user_signed_up', [
    'signup_method' => 'form',
]);
```

### User Login (`app/Http/Livewire/Auth/Login.php`)
Users are identified on login with their properties:
```php
$posthog->identify($user->email, $user->getPostHogProperties());
$posthog->capture($user->email, 'user_logged_in', [
    'login_method' => 'password',
]);
```

### User Logout (`routes/web.php`)
Logout events are tracked:
```php
$posthog->capture($user->email, 'user_logged_out');
```

### Page View Tracking
Dashboard and profile views are tracked (`app/Http/Livewire/Dashboard.php`, `app/Http/Livewire/Profile.php`):
```php
$posthog->capture($user->email, 'dashboard_viewed', [
    'is_staff' => $user->is_staff,
]);

$posthog->capture($user->email, 'profile_viewed');
```

### Custom Event Tracking (`app/Http/Livewire/BurritoTracker.php`)
The burrito tracker demonstrates custom event capture:
```php
$posthog->identify($user->email, $user->getPostHogProperties());
$posthog->capture($user->email, 'burrito_considered', [
    'total_considerations' => $this->burritoCount,
]);
```

### Feature Flags (`app/Http/Livewire/Dashboard.php`)
The dashboard demonstrates feature flag checking:
```php
$this->showNewFeature = $posthog->isFeatureEnabled(
    'new-dashboard-feature',
    $user->email,
    $user->getPostHogProperties()
) ?? false;

$this->featureConfig = $posthog->getFeatureFlagPayload(
    'new-dashboard-feature',
    $user->email
);
```

### Error Tracking
Manual exception capture is demonstrated in multiple places:

**Livewire Components** (`app/Http/Livewire/Dashboard.php`, `app/Http/Livewire/Profile.php`):
```php
try {
    throw new \Exception('This is a test error for PostHog tracking');
} catch (\Exception $e) {
    $errorId = $posthog->captureException($e, $user->email);
    $this->successMessage = "Error captured in PostHog! Error ID: {$errorId}";
}
```

**API Endpoint** (`app/Http/Controllers/Api/ErrorTestController.php`):
```php
try {
    throw new \Exception('Test exception from critical operation');
} catch (\Throwable $e) {
    if ($shouldCapture) {
        $posthog->identify($user->email, $user->getPostHogProperties());
        $eventId = $posthog->captureException($e, $user->email);

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
basics/laravel/
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
│   ├── Models/
│   │   └── User.php                        # User model with PostHog properties
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