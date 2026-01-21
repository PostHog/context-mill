# PostHog Laravel Example

A Laravel application demonstrating PostHog integration for analytics, feature flags, and error tracking using the TALL stack (Tailwind-like styling, Alpine.js concepts via Livewire, Laravel, Livewire).

## Features

- User registration and authentication with Livewire
- SQLite database persistence with Eloquent ORM
- User identification and property tracking
- Custom event tracking
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
   composer require livewire/livewire posthog/posthog-php
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

4. Create database and run migrations:
   ```bash
   touch database/database.sqlite
   php artisan migrate --seed
   ```

5. Start the development server:
   ```bash
   php artisan serve
   ```

6. Open http://localhost:8000 and either:
   - Login with default credentials: `admin@example.com` / `admin`
   - Or click "Sign up here" to create a new account

## PostHog Integration Points

### User Registration
New users are identified and tracked on signup:
```php
$posthog->identify($user->email, $user->getPostHogProperties());
$posthog->capture($user->email, 'user_signed_up', [
    'signup_method' => 'form'
]);
```

### User Identification
Users are identified on login with their properties:
```php
$posthog->identify($user->email, $user->getPostHogProperties());
$posthog->capture($user->email, 'user_logged_in', [
    'login_method' => 'password'
]);
```

### Event Tracking
Custom events are captured throughout the app:
```php
$posthog->capture($user->email, 'burrito_considered', [
    'total_considerations' => $burritoCount
]);
```

### Feature Flags
The dashboard demonstrates feature flag checking:
```php
$showNewFeature = $posthog->isFeatureEnabled(
    'new-dashboard-feature',
    $user->email,
    $user->getPostHogProperties()
);

$featureConfig = $posthog->getFeatureFlagPayload(
    'new-dashboard-feature',
    $user->email
);
```

### Error Tracking

Manual capture for specific critical operations (`app/Http/Controllers/Api/ErrorTestController.php`):

```php
try {
    // Critical operation that might fail
    processPayment();
} catch (\Throwable $e) {
    // Manually capture this specific exception
    $posthog->identify($user->email, $user->getPostHogProperties());
    $eventId = $posthog->captureException($e, $user->email);

    return response()->json([
        'error' => 'Operation failed',
        'error_id' => $eventId,
        'message' => "Error captured in PostHog. Reference ID: {$eventId}"
    ], 500);
}
```

The `/api/test-error` endpoint demonstrates manual exception capture. Use `?capture=true` to capture in PostHog, or `?capture=false` to skip tracking.

## Project Structure

```
basics/laravel/
├── app/
│   ├── Http/
│   │   ├── Controllers/Api/     # API controllers
│   │   └── Livewire/            # Livewire components
│   ├── Models/                  # Eloquent models
│   └── Services/                # PostHog service
├── database/
│   ├── migrations/              # Database migrations
│   └── seeders/                 # Database seeders
├── resources/
│   └── views/
│       ├── components/          # Blade components
│       ├── livewire/            # Livewire views
│       └── errors/              # Error pages
├── routes/
│   ├── web.php                  # Web routes
│   └── api.php                  # API routes
└── config/
    └── posthog.php              # PostHog config
```

## Key Differences from Flask Version

| Aspect | Flask | Laravel |
|--------|-------|---------|
| Project Structure | Application factory + blueprints | MVC + Service Container |
| Database | SQLite via Flask-SQLAlchemy | SQLite via Eloquent ORM |
| User Model | Custom SQLAlchemy model | Eloquent User model |
| Authentication | Flask-Login | Laravel Breeze concepts |
| Session Management | Cookie-based | Database/file sessions |
| Configuration | Config classes | .env + config files |
| URL Routing | Blueprint decorators | Route definitions |
| PostHog Init | Application factory | Service class |
| Error Capture | Manual in endpoints | Manual in endpoints |
| Templates | Jinja2 | Blade + Livewire |
| Reactivity | JavaScript fetch API | Livewire |

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

## Implementation Notes

This is a demonstration project showing PostHog integration patterns. For a full production application, you would need:

1. Complete Laravel installation via Composer
2. Proper asset compilation setup (Vite)
3. Additional middleware and authentication scaffolding
4. Comprehensive error handling
5. Testing suite
6. Production deployment configuration

## License

This example is provided for demonstration purposes.
