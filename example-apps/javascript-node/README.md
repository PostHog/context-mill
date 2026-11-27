# PostHog Node.js Example: Todo API

A simple Express server demonstrating PostHog Node.js integration for server-side applications (APIs, backends, workers, etc.).

## Purpose

This example serves as:

- **Verification** that the context-mill wizard works for plain Node.js projects
- **Reference implementation** of PostHog best practices for server-side Node.js code
- **Working example** you can run and modify

## Features

- **Event capture**: tracks user actions with `posthog.capture()` when a `user_id` is supplied, and skips capture when missing rather than falling back to `anonymous`
- **User identification**: `POST /login` validates input and calls `posthog.identify()` once on login with a stable UUID primary key
- **Feature flags**: gates the stats endpoint detail level with `posthog.evaluateFlags()`
- **Error tracking**: captures exceptions with `posthog.captureException()` and `enableExceptionAutocapture`
- **Graceful shutdown**: flushes pending events with `await posthog?.shutdown(3000)` inside `server.close()` on SIGINT and SIGTERM

## Quick start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure PostHog

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your PostHog project token
# POSTHOG_PROJECT_TOKEN=<your_project_token>
# POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Run the server

```bash
npm start
# Todo API running at http://localhost:3000
```

### 4. Try it out

```bash
# Log in to get a stable UUID user_id
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "ada"}'

# Add a todo (replace <user_id> with the UUID returned by /login)
curl -X POST http://localhost:3000/todos \
  -H 'Content-Type: application/json' \
  -d '{"text": "Buy groceries", "user_id": "<user_id>"}'

# List all todos
curl "http://localhost:3000/todos?user_id=<user_id>"

# Complete a todo
curl -X PATCH http://localhost:3000/todos/1/complete \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "<user_id>"}'

# Delete a todo
curl -X DELETE "http://localhost:3000/todos/1?user_id=<user_id>"

# Show statistics
curl "http://localhost:3000/stats?user_id=<user_id>"
```

## What gets tracked

The app tracks these events in PostHog when a `user_id` is present:

| Event | Properties | Purpose |
|-------|-----------|---------|
| `user_logged_in` | `login_method`, `is_new_user` | When a user logs in on `POST /login` |
| `todo_added` | `todo_id`, `todo_length`, `total_todos` | When a todo is created |
| `todos_viewed` | `total_todos`, `completed_todos` | When todos are listed |
| `todo_completed` | `todo_id`, `time_to_complete_hours` | When a todo is completed |
| `todo_deleted` | `todo_id`, `was_completed` | When a todo is deleted |
| `stats_viewed` | `total_todos`, `completed_todos`, `pending_todos` | When stats are requested |

## Code structure

```
example-apps/javascript-node/
├── todo.js              # Express server with PostHog tracking
├── package.json         # Node.js dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Patterns

### 1. Instance-based initialization

Return `null` when `POSTHOG_PROJECT_TOKEN` is unset rather than constructing a client with a placeholder string.

```javascript
import { PostHog } from 'posthog-node';

function initializePosthog() {
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN?.trim();
  if (!projectToken) return null;

  return new PostHog(projectToken, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    enableExceptionAutocapture: true,
  });
}
```

### 2. Event tracking on routes

Skip `capture` when `user_id` is missing instead of falling back to a shared `anonymous` literal.

```javascript
app.post('/todos', (req, res) => {
  // ... create todo ...

  const userId = normalizeUserId(req.body?.user_id);
  if (posthog && userId) {
    posthog.capture({
      distinctId: userId,
      event: 'todo_added',
      properties: { todo_id: todo.id },
    });
  }

  res.status(201).json(todo);
});
```

### 3. Graceful shutdown

```javascript
function shutdown() {
  server.close(async () => {
    await posthog?.shutdown(3000);
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

## Learn more

- [PostHog Node.js SDK Documentation](https://posthog.com/docs/libraries/node)
- [PostHog Node.js SDK API Reference](https://posthog.com/docs/references/posthog-node)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
