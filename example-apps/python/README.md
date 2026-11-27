# PostHog Python Example - CLI Todo App

A simple command-line todo application built with plain Python (no frameworks) demonstrating PostHog integration for CLIs, scripts, data pipelines, and non-web Python applications.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain Python projects
- **Reference implementation** of PostHog best practices for non-framework Python code
- **Working example** you can run and modify

## Features Demonstrated

- **Instance-based API**: Uses the `Posthog(...)` class instead of module-level state
- **Exception autocapture**: Automatic tracking of unhandled exceptions
- **Proper shutdown**: Registers `atexit.register(client.shutdown)` and calls `shutdown()` before exit
- **Event tracking**: Captures user actions with a persistent `distinct_id` and non-PII properties
- **Person properties and context**: Sets person properties via `set()` and `set_once()`, or scopes request identity with `identify_context()` (the Python SDK has no `identify()` method)
- **Error handling**: Manual exception capture for handled errors

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

# Edit .env and set POSTHOG_PROJECT_TOKEN
# POSTHOG_PROJECT_TOKEN=
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
example-apps/python/
├── todo.py              # Main CLI application
├── requirements.txt     # Python dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Key Implementation Patterns

### 1. Instance-Based Initialization

```python
import atexit
from posthog import Posthog

posthog_client = Posthog(
    project_token,
    host="https://us.i.posthog.com",
    enable_exception_autocapture=True,
)
atexit.register(posthog_client.shutdown)
```

### 2. Event Tracking Pattern

```python
posthog_client.capture(
    distinct_id=user_id,
    event="todo_added",
    properties={"todo_id": 1, "todo_length": 13, "total_todos": 1},
)
```

### 3. Proper Shutdown

```python
try:
    run_cli()
finally:
    if posthog_client:
        try:
            posthog_client.shutdown()
        except Exception:
            pass
```

### 4. Setting Person Properties

The Python SDK has no `identify()` method. Set person properties via `set()` or `set_once()`, or use `identify_context()` inside a `new_context()` block:

```python
posthog_client.set(
    distinct_id=user_id,
    properties={"email": "user@example.com", "plan": "pro"},
)
```

### 5. Exception Handling

```python
try:
    risky_operation()
except Exception as e:
    if posthog_client:
        posthog_client.capture_exception(e, distinct_id=user_id)
```

## Running Without PostHog

When `POSTHOG_PROJECT_TOKEN` is unset, the CLI logs a warning to `stderr` outside production, skips client creation, and runs todos normally.

## Next Steps

- Modify `todo.py` to experiment with PostHog tracking
- Add new commands and track their usage
- Explore feature flags: `posthog_client.feature_enabled("flag-name", user_id)`
- Check your PostHog dashboard to see tracked events

## Learn More

- [PostHog Python SDK Documentation](https://posthog.com/docs/libraries/python)
- [PostHog Python SDK API Reference](https://posthog.com/docs/references/posthog-python)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
