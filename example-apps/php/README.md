# PostHog PHP Example - CLI Todo App

A simple command-line todo application built with plain PHP (no framework) demonstrating PostHog integration for CLIs, scripts, data pipelines, and non-web PHP applications.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain PHP projects
- **Reference implementation** of PostHog best practices for non-framework PHP code
- **Working example** you can run and modify

## Features Demonstrated

- **SDK initialization** - Uses `PostHog::init(...)` once with environment-based configuration
- **Event tracking** - Captures user actions with `distinctId` and properties
- **User identification** - Associates properties with users via `PostHog::identify(...)`
- **Error tracking** - Enables automatic PHP error tracking and manually captures handled exceptions
- **Proper flushing** - Calls `PostHog::flush()` before CLI exit

## Quick Start

### 1. Install Dependencies

```bash
composer install
```

### 2. Configure PostHog

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your PostHog project token
# POSTHOG_PROJECT_TOKEN=phc_your_project_token_here
# POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Run the App

```bash
# Add a todo
php todo.php add "Buy groceries"

# List all todos
php todo.php list

# Complete a todo
php todo.php complete 1

# Delete a todo
php todo.php delete 1

# Show statistics
php todo.php stats
```

## What Gets Tracked

The app tracks these events in PostHog:

| Event | Properties | Purpose |
|-------|-----------|---------|
| `todo_added` | `todo_id`, `todo_length`, `total_todos` | When user adds a new todo |
| `todos_viewed` | `total_todos`, `completed_todos` | When user lists todos |
| `todo_completed` | `todo_id`, `time_to_complete_hours` | When user completes a todo |
| `todo_deleted` | `todo_id`, `was_completed` | When user deletes a todo |
| `stats_viewed` | `total_todos`, `completed_todos`, `pending_todos` | When user views stats |
| `$exception` | exception details and command context | When handled errors occur |

## Code Structure

```
basics/php/
├── todo.php             # Main CLI application
├── composer.json        # PHP dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Key Implementation Patterns

### 1. Initialize Once

```php
PostHog::init($projectToken, [
    'host' => $host,
    'error_tracking' => [
        'enabled' => true,
    ],
]);
```

### 2. Event Tracking Pattern

```php
PostHog::capture([
    'distinctId' => 'user_123',
    'event' => 'event_name',
    'properties' => ['key' => 'value'],
]);
```

### 3. Identifying Users

```php
PostHog::identify([
    'distinctId' => 'user_123',
    'properties' => ['app_language' => 'php'],
]);
```

### 4. Exception Tracking

```php
try {
    riskyOperation();
} catch (Throwable $e) {
    PostHog::captureException($e, 'user_123', [
        'command' => 'example_command',
    ]);
}
```

### 5. Flush Before CLI Exit

```php
PostHog::flush();
```

## Running Without PostHog

The app works fine without PostHog configured - it simply won't track analytics. You'll see a warning message but the app continues to function normally.

## Next Steps

- Modify `todo.php` to experiment with PostHog tracking
- Add new commands and track their usage
- Explore feature flags: `PostHog::isFeatureEnabled('flag-name', 'user_id')`
- Check your PostHog dashboard to see tracked events

## Learn More

- [PostHog PHP SDK Documentation](https://posthog.com/docs/libraries/php)
- [PostHog PHP Error Tracking](https://posthog.com/docs/error-tracking/installation/php)
- [PostHog Product Analytics PHP installation](https://posthog.com/docs/product-analytics/installation/php)
