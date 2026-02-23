# PostHog Node.js Example - Todo API

A simple Express server demonstrating PostHog Node.js integration for server-side applications (APIs, backends, workers, etc.).

## Purpose

This example serves as:

- **Verification** that the context-mill wizard works for plain Node.js projects
- **Reference implementation** of PostHog best practices for server-side Node.js code
- **Working example** you can run and modify

## Features

- **Event capture** – tracks user actions with `posthog.capture()` on each route
- **User identification** – calls `posthog.identify()` on write actions to associate user traits
- **Feature flags** – gates the stats endpoint detail level with `posthog.isFeatureEnabled()`
- **Error tracking** – captures exceptions with `posthog.captureException()` and `enableExceptionAutocapture`
- **Graceful shutdown** – flushes pending events with `await posthog.shutdown()` on SIGINT/SIGTERM

## Quick start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure PostHog

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your PostHog API key
# POSTHOG_API_KEY=phc_your_api_key_here
# POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Run the server

```bash
npm start
# Todo API running at http://localhost:3000
```

### 4. Try it out

```bash
# Add a todo
curl -X POST http://localhost:3000/todos \
  -H 'Content-Type: application/json' \
  -d '{"text": "Buy groceries", "user_id": "user_123"}'

# List all todos
curl http://localhost:3000/todos

# Complete a todo
curl -X PATCH http://localhost:3000/todos/1/complete \
  -H 'Content-Type: application/json' \
  -d '{"user_id": "user_123"}'

# Delete a todo
curl -X DELETE http://localhost:3000/todos/1

# Show statistics
curl http://localhost:3000/stats
```

## What gets tracked

The app tracks these events in PostHog:

| Event | Properties | Purpose |
|-------|-----------|---------|
| `todo_added` | `todo_id`, `todo_length`, `total_todos` | When a todo is created |
| `todos_viewed` | `total_todos`, `completed_todos` | When todos are listed |
| `todo_completed` | `todo_id`, `time_to_complete_hours` | When a todo is completed |
| `todo_deleted` | `todo_id`, `was_completed` | When a todo is deleted |
| `stats_viewed` | `total_todos`, `completed_todos`, `pending_todos` | When stats are requested |

## Code structure

```
basics/javascript-node/
├── todo.js              # Express server with PostHog tracking
├── package.json         # Node.js dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Patterns

### 1. Instance-based initialization

```javascript
import { PostHog } from 'posthog-node';

const posthog = new PostHog(apiKey, {
  host: 'https://us.i.posthog.com',
});
```

### 2. Event tracking on routes

```javascript
app.post('/todos', (req, res) => {
  // ... create todo ...

  posthog.capture({
    distinctId: req.body.user_id,
    event: 'todo_added',
    properties: { todo_id: todo.id },
  });

  res.status(201).json(todo);
});
```

### 3. Graceful shutdown

```javascript
async function shutdown() {
  server.close();
  await posthog.shutdown(); // Flush pending events
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
```

## Learn more

- [PostHog Node.js SDK Documentation](https://posthog.com/docs/libraries/node)
- [PostHog Node.js SDK API Reference](https://posthog.com/docs/references/posthog-node)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
