# PostHog PHP Example - CLI Todo App

A simple command-line todo application built with plain PHP (no framework) demonstrating PostHog integration for CLIs, scripts, data pipelines, and non-web PHP applications.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain PHP projects
- **Reference implementation** of PostHog best practices for non-framework PHP code
- **Working example** you can run and modify

## Features Demonstrated

- **SDK initialization**: Calls `PostHog::init(...)` once when `POSTHOG_PROJECT_TOKEN` is configured
- **Event tracking**: Captures user actions with a persistent UUID `distinctId` and non-PII properties
- **User identification**: Calls `PostHog::identify(...)` once when first creating the installation user record
- **Error tracking**: Enables automatic PHP error tracking and manually captures handled exceptions
- **Safe flushing**: Wraps `PostHog::flush()` in `try / catch` before CLI exit

## Quick Start

### 1. Install Dependencies

```bash
composer install
```

### 2. Configure PostHog

```bash
# Copy environment template
cp .env.example .env

# Edit .env and set POSTHOG_PROJECT_TOKEN
# POSTHOG_PROJECT_TOKEN=
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
| `$exception` | Exception details and command context | When handled errors occur |

## Code Structure

```
example-apps/php/
├── todo.php             # Main CLI application
├── composer.json        # PHP dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Key Implementation Patterns

### 1. Guarded Initialization

```php
$projectToken = trim((string) ($_ENV['POSTHOG_PROJECT_TOKEN'] ?? getenv('POSTHOG_PROJECT_TOKEN') ?: ''));
if ($projectToken !== '') {
    PostHog::init($projectToken, [
        'host' => $host,
        'error_tracking' => [
            'enabled' => true,
        ],
    ]);
}
```

### 2. Event Tracking Pattern

```php
PostHog::capture([
    'distinctId' => $userId,
    'event' => 'todo_added',
    'properties' => ['todo_id' => 1, 'todo_length' => 13, 'total_todos' => 1],
]);
```

### 3. Identifying Users Once on Creation

```php
if ($isNewUser && $posthogEnabled) {
    PostHog::identify([
        'distinctId' => $userId,
        'properties' => ['app_language' => 'php', 'app_type' => 'cli'],
    ]);
}
```

### 4. Exception Tracking

```php
try {
    riskyOperation();
} catch (Throwable $e) {
    PostHog::captureException($e, $userId, [
        'command' => $command,
    ]);
}
```

### 5. Safe Flush Before CLI Exit

```php
try {
    PostHog::flush();
} catch (Throwable) {
    // Analytics flush failures must never fail the CLI command.
}
```

## Running Without PostHog

When `POSTHOG_PROJECT_TOKEN` is unset, the CLI writes a warning to `STDERR` outside production, skips `PostHog::init`, and executes commands normally.

## Next Steps

- Modify `todo.php` to experiment with PostHog tracking
- Add new commands and track their usage
- Explore feature flags: `PostHog::isFeatureEnabled('flag-name', $userId)`
- Check your PostHog dashboard to see tracked events

## Learn More

- [PostHog PHP SDK Documentation](https://posthog.com/docs/libraries/php)
- [PostHog PHP Error Tracking](https://posthog.com/docs/error-tracking/installation/php)
- [PostHog Product Analytics PHP installation](https://posthog.com/docs/product-analytics/installation/php)
