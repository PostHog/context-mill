# PostHog Python Example - CLI Todo App

A simple command-line todo application built with plain Python (no frameworks) demonstrating PostHog integration for CLIs, scripts, data pipelines, and non-web Python applications.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain Python projects
- **Reference implementation** of PostHog best practices for non-framework Python code
- **Working example** you can run and modify

## Features Demonstrated

- **Instance-based API** - Uses `Posthog(...)` instead of module-level API
- **Exception autocapture** - Automatic tracking of unhandled exceptions
- **Proper shutdown** - Uses `shutdown()` instead of `flush()`
- **Context pattern** - Always uses `new_context()` + `identify_context()`
- **User identification** - Tracks events per user
- **Event tracking** - Captures user actions with properties
- **Error handling** - Manual exception capture for handled errors

## Quick Start

### 1. Install Dependencies

```bash
# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure PostHog

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your PostHog API key
# POSTHOG_API_KEY=phc_your_api_key_here
# POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Run the App

```bash
# Add a todo
python todo.py add "Buy groceries"

# List all todos
python todo.py list

# Complete a todo
python todo.py complete 1

# Delete a todo
python todo.py delete 1

# Show statistics
python todo.py stats
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

## Code Structure

```
basics/python/
├── todo.py              # Main CLI application
├── requirements.txt     # Python dependencies
├── .env.example        # Environment variable template
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## Key Implementation Patterns

### 1. Instance-Based Initialization

```python
from posthog import Posthog

posthog = Posthog(
    api_key,
    host='https://us.i.posthog.com',
    enable_exception_autocapture=True  # Automatically capture exceptions
)
```

### 2. Event Tracking Pattern

```python
from posthog import new_context, identify_context, capture

# Always use this pattern for tracking events
with new_context():
    identify_context(user_id)
    capture("event_name", properties={"key": "value"})
```

### 3. Proper Shutdown

```python
try:
    # Your application code
    pass
finally:
    # Always call shutdown() to flush events and close connections
    posthog.shutdown()
```

### 4. Exception Handling

```python
try:
    # Code that might fail
    risky_operation()
except Exception as e:
    # Manually capture handled errors you want to track
    with new_context():
        identify_context(user_id)
        posthog.capture_exception(e)
```

## Running Without PostHog

The app works fine without PostHog configured - it simply won't track analytics. You'll see a warning message but the app continues to function normally.

## Next Steps

- Modify `todo.py` to experiment with PostHog tracking
- Add new commands and track their usage
- Explore feature flags: `posthog.feature_enabled('flag-name', user_id)`
- Check your PostHog dashboard to see tracked events

## Learn More

- [PostHog Python SDK Documentation](https://posthog.com/docs/libraries/python)
- [PostHog Python SDK API Reference](https://posthog.com/docs/references/posthog-python)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
