/**
 * Simple Todo API with PostHog Analytics
 *
 * A minimal Express server demonstrating PostHog Node.js integration
 * for server-side applications (APIs, backends, workers, etc.).
 */

import express from 'express';
import { PostHog } from 'posthog-node';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

// In-memory store, replaced with a database in production
const todos = [];
let nextId = 1;

// --- PostHog Setup ---

function initializePosthog() {
  const projectToken = process.env.POSTHOG_PROJECT_TOKEN;

  if (!projectToken) {
    console.log('WARNING: PostHog not configured (POSTHOG_PROJECT_TOKEN not set)');
    console.log('         App will work but analytics won\'t be tracked');
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

function trackEvent(distinctId, event, properties = {}) {
  if (!posthog) return;

  posthog.capture({
    distinctId,
    event,
    properties,
  });
}

function identifyUser(distinctId, properties = {}) {
  if (!posthog) return;

  posthog.identify({
    distinctId,
    properties,
  });
}

// --- Routes ---

// Add a todo
app.post('/todos', (req, res) => {
  const { text, user_id } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const userId = user_id || 'anonymous';

  const todo = {
    id: nextId++,
    text,
    completed: false,
    created_at: new Date().toISOString(),
  };

  todos.push(todo);

  identifyUser(userId, {
    last_active: new Date().toISOString(),
    total_todos_created: todos.length,
  });

  trackEvent(userId, 'todo_added', {
    todo_id: todo.id,
    todo_length: text.length,
    total_todos: todos.length,
  });

  res.status(201).json(todo);
});

// List all todos
app.get('/todos', (req, res) => {
  const userId = req.query.user_id || 'anonymous';

  trackEvent(userId, 'todos_viewed', {
    total_todos: todos.length,
    completed_todos: todos.filter((t) => t.completed).length,
  });

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

  const userId = req.body.user_id || 'anonymous';

  trackEvent(userId, 'todo_completed', {
    todo_id: todo.id,
    time_to_complete_hours:
      (new Date(todo.completed_at) - new Date(todo.created_at)) / 3600000,
  });

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

  const userId = req.query.user_id || 'anonymous';

  trackEvent(userId, 'todo_deleted', {
    todo_id: todo.id,
    was_completed: todo.completed,
  });

  res.status(204).end();
});

// Stats — uses a feature flag to gate detailed response
app.get('/stats', async (req, res) => {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const pending = total - completed;

  const userId = req.query.user_id || 'anonymous';

  const stats = {
    total,
    completed,
    pending,
    completion_rate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0',
  };

  // Check feature flag to decide whether to include per-todo breakdown
  if (posthog) {
    const showDetailed = await posthog.isFeatureEnabled(
      'detailed-analytics',
      userId,
    );

    if (showDetailed) {
      stats.todos = todos.map((t) => ({
        id: t.id,
        completed: t.completed,
        age_hours: (Date.now() - new Date(t.created_at)) / 3600000,
      }));
    }
  }

  trackEvent(userId, 'stats_viewed', {
    total_todos: total,
    completed_todos: completed,
    pending_todos: pending,
  });

  res.json(stats);
});

// --- Error Handling ---

// Global error handler — capture exceptions to PostHog
app.use((err, req, res, _next) => {
  const userId = req.body?.user_id || req.query?.user_id || 'anonymous';

  if (posthog) {
    posthog.captureException(err, userId);
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
async function shutdown() {
  console.log('\nShutting down...');
  server.close();
  if (posthog) {
    await posthog.shutdown();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
