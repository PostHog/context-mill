/**
 * Simple Todo API with PostHog Analytics
 *
 * A minimal Express server demonstrating PostHog Node.js integration
 * for server-side applications (APIs, backends, workers, etc.).
 */

import { randomUUID } from 'node:crypto';
import express from 'express';
import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// In-memory stores, replaced with a database in production
const todos = [];
const users = new Map();
let nextId = 1;

// --- PostHog Setup ---

function initializePosthog() {
  // Return null when POSTHOG_PROJECT_TOKEN is unset rather than passing an empty
  // or placeholder key, and warn once outside production.
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN?.trim();

  if (!projectToken) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
      );
    }
    return null;
  }

  const client = new PostHog(projectToken, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    enableExceptionAutocapture: true,
  });

  if (process.env.POSTHOG_DEBUG === 'true') {
    client.debug();
  }

  return client;
}

const posthog = initializePosthog();

function normalizeUserId(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// Never fall back to a shared literal like anonymous. When user_id is missing on
// a request, skip identify and capture so unrelated callers are never merged into
// one fake person profile.
function trackEvent(distinctId, event, properties = {}) {
  const id = normalizeUserId(distinctId);
  if (!posthog || !id) return;

  posthog.capture({
    distinctId: id,
    event,
    properties,
  });
}

function identifyUser(distinctId, properties = {}) {
  const id = normalizeUserId(distinctId);
  if (!posthog || !id) return;

  posthog.identify({
    distinctId: id,
    properties,
  });
}

// --- Routes ---

// Log in and identify once with a stable UUID primary key
app.post('/login', (req, res) => {
  // Reject blank usernames before identifying or capturing so missing identity
  // never falls back to a placeholder user.
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  let user = users.get(username);
  const isNewUser = !user;
  if (!user) {
    user = { id: randomUUID(), username };
    users.set(username, user);
  }

  identifyUser(user.id, { username: user.username });
  trackEvent(user.id, 'user_logged_in', {
    login_method: 'username',
    is_new_user: isNewUser,
  });

  res.json({ user_id: user.id, username: user.username });
});

// Add a todo
app.post('/todos', (req, res) => {
  const { text, user_id } = req.body ?? {};

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const todo = {
    id: nextId++,
    text,
    completed: false,
    created_at: new Date().toISOString(),
  };

  todos.push(todo);

  // Skip event capture when user_id is absent rather than falling back to anonymous.
  const userId = normalizeUserId(user_id);
  if (userId) {
    trackEvent(userId, 'todo_added', {
      todo_id: todo.id,
      todo_length: text.length,
      total_todos: todos.length,
    });
  }

  res.status(201).json(todo);
});

// List all todos
app.get('/todos', (req, res) => {
  const userId = normalizeUserId(req.query?.user_id);

  if (userId) {
    trackEvent(userId, 'todos_viewed', {
      total_todos: todos.length,
      completed_todos: todos.filter((t) => t.completed).length,
    });
  }

  res.json(todos);
});

// Complete a todo
app.patch('/todos/:id/complete', (req, res) => {
  const todo = todos.find((t) => t.id === parseInt(req.params.id, 10));

  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  if (todo.completed) {
    return res.status(400).json({ error: 'Todo already completed' });
  }

  todo.completed = true;
  todo.completed_at = new Date().toISOString();

  const userId = normalizeUserId(req.body?.user_id);
  if (userId) {
    trackEvent(userId, 'todo_completed', {
      todo_id: todo.id,
      time_to_complete_hours:
        (new Date(todo.completed_at) - new Date(todo.created_at)) / 3600000,
    });
  }

  res.json(todo);
});

// Delete a todo
app.delete('/todos/:id', (req, res) => {
  const index = todos.findIndex((t) => t.id === parseInt(req.params.id, 10));

  if (index === -1) {
    return res.status(404).json({ error: 'Todo not found' });
  }

  const todo = todos[index];
  todos.splice(index, 1);

  const userId = normalizeUserId(req.query?.user_id ?? req.body?.user_id);
  if (userId) {
    trackEvent(userId, 'todo_deleted', {
      todo_id: todo.id,
      was_completed: todo.completed,
    });
  }

  res.status(204).end();
});

// Stats, uses a feature flag to gate detailed response when user_id is provided
app.get('/stats', async (req, res) => {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const pending = total - completed;

  const stats = {
    total,
    completed,
    pending,
    completion_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0',
  };

  // Skip flag evaluation and capture when user_id is missing instead of falling
  // back to a shared anonymous id.
  const userId = normalizeUserId(req.query?.user_id);
  if (posthog && userId) {
    try {
      const flags = await posthog.evaluateFlags(userId);
      const showDetailed = flags.isEnabled('detailed-analytics');

      if (showDetailed) {
        stats.todos = todos.map((t) => ({
          id: t.id,
          completed: t.completed,
          age_hours: (Date.now() - new Date(t.created_at)) / 3600000,
        }));
      }
    } catch (error) {
      console.warn('Feature flag evaluation failed:', error);
    }

    trackEvent(userId, 'stats_viewed', {
      total_todos: total,
      completed_todos: completed,
      pending_todos: pending,
    });
  }

  res.json(stats);
});

// --- Error Handling ---

// Global error handler, capture exceptions to PostHog
app.use((err, req, res, _next) => {
  // Use the caller's user_id when present, or generate a per-request UUID with
  // person profile creation disabled rather than sharing an anonymous literal.
  const userId = normalizeUserId(req.body?.user_id) ?? normalizeUserId(req.query?.user_id);

  if (posthog) {
    if (userId) {
      posthog.captureException(err, { distinctId: userId });
    } else {
      posthog.captureException(err, {
        distinctId: randomUUID(),
        options: { process_person_profile: false },
      });
    }
  }

  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// --- Server ---

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Todo API running at http://localhost:${PORT}`);
});

// Graceful shutdown, flush PostHog events before exiting
function shutdown() {
  console.log('\nShutting down...');
  server.close(async () => {
    await posthog?.shutdown(3000);
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
