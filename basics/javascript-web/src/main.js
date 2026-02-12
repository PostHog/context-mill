/**
 * Simple Todo App with PostHog Analytics
 *
 * A minimal vanilla JavaScript application demonstrating PostHog integration
 * for non-framework browser JavaScript projects.
 */
import posthog from './posthog.js';

// --- State ---

let todos = JSON.parse(localStorage.getItem('todos') || '[]');
let currentUser = localStorage.getItem('currentUser') || null;

// --- DOM Elements ---

const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const totalCount = document.getElementById('total-count');
const completedCount = document.getElementById('completed-count');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameInput = document.getElementById('username-input');
const usernameDisplay = document.getElementById('username-display');
const loggedOutSection = document.getElementById('logged-out');
const loggedInSection = document.getElementById('logged-in');

// --- Auth ---

function login() {
  const username = usernameInput.value.trim();
  if (!username) return;

  currentUser = username;
  localStorage.setItem('currentUser', username);

  // Identify user in PostHog — links all future events to this user
  // Pass person properties as second arg (this is where name/email belong, NOT in capture())
  posthog.identify(username, { name: username });

  posthog.capture('user_logged_in');

  updateAuthUI();
  usernameInput.value = '';
}

function logout() {
  currentUser = null;
  localStorage.removeItem('currentUser');

  // Reset PostHog — unlinks future events from the current user
  // and generates a new anonymous distinct_id
  posthog.reset();

  posthog.capture('user_logged_out');

  updateAuthUI();
}

function updateAuthUI() {
  if (currentUser) {
    loggedOutSection.hidden = true;
    loggedInSection.hidden = false;
    usernameDisplay.textContent = currentUser;
  } else {
    loggedOutSection.hidden = false;
    loggedInSection.hidden = true;
  }
}

// --- Todos ---

function addTodo(text) {
  const todo = {
    id: Date.now(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
  };

  todos.push(todo);
  saveTodos();
  renderTodos();

  // Track the event — only metadata, never PII or user-generated content
  posthog.capture('todo_added', {
    todo_id: todo.id,
    text_length: text.length,
    total_todos: todos.length,
  });
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  todo.completed = !todo.completed;
  saveTodos();
  renderTodos();

  if (todo.completed) {
    const timeToComplete =
      (Date.now() - new Date(todo.createdAt).getTime()) / 3600000;

    posthog.capture('todo_completed', {
      todo_id: todo.id,
      time_to_complete_hours: Math.round(timeToComplete * 100) / 100,
    });
  }
}

function deleteTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  renderTodos();

  posthog.capture('todo_deleted', {
    todo_id: todo.id,
    was_completed: todo.completed,
  });
}

function saveTodos() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

// --- Rendering ---

function renderTodos() {
  todoList.innerHTML = '';

  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    li.append(checkbox, text, deleteBtn);
    todoList.appendChild(li);
  }

  // Update stats
  const completed = todos.filter((t) => t.completed).length;
  totalCount.textContent = `${todos.length} item${todos.length !== 1 ? 's' : ''}`;
  completedCount.textContent = `${completed} completed`;
}

// --- Error Tracking ---

// Capture unhandled errors with PostHog
window.addEventListener('error', (event) => {
  posthog.captureException(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  posthog.captureException(event.reason);
});

// --- Event Listeners ---

todoForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = todoInput.value.trim();
  if (text) {
    addTodo(text);
    todoInput.value = '';
  }
});

loginBtn.addEventListener('click', login);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') login();
});
logoutBtn.addEventListener('click', logout);

// --- Init ---

// Restore auth state and re-identify if already logged in
if (currentUser) {
  posthog.identify(currentUser, { name: currentUser });
}

updateAuthUI();
renderTodos();
