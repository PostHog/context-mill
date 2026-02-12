# PostHog JavaScript Example - Browser Todo App

A simple browser-based todo application built with vanilla JavaScript and Vite, demonstrating PostHog integration for non-framework JavaScript projects.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain JavaScript projects
- **Reference implementation** of PostHog best practices for vanilla JS browser apps
- **Working example** you can run and modify

## Features Demonstrated

- **PostHog initialization** - `posthog.init()` with `api_host` configuration
- **Autocapture** - Automatic tracking of clicks, form submissions, and pageviews (enabled by default)
- **Custom event tracking** - Manual `posthog.capture()` calls with event properties
- **User identification** - `posthog.identify()` on login and `posthog.reset()` on logout
- **Error tracking** - `posthog.captureException()` for unhandled errors and promise rejections

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure PostHog

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your PostHog API key
# VITE_POSTHOG_KEY=phc_your_api_key_here
# VITE_POSTHOG_HOST=https://us.i.posthog.com
```

### 3. Run the App

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## What Gets Tracked

The app tracks these custom events in PostHog (in addition to autocaptured clicks and pageviews):

| Event | Properties | Purpose |
|-------|-----------|---------|
| `todo_added` | `todo_id`, `text_length`, `total_todos` | When user adds a new todo |
| `todo_completed` | `todo_id`, `time_to_complete_hours` | When user completes a todo |
| `todo_deleted` | `todo_id`, `was_completed` | When user deletes a todo |
| `user_logged_in` | (none) | When user logs in |
| `user_logged_out` | (none) | When user logs out |

## Code Structure

```
basics/javascript/
├── index.html           # Entry HTML page
├── package.json         # Dependencies (posthog-js, vite)
├── vite.config.js       # Vite configuration
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
├── README.md            # This file
└── src/
    ├── posthog.js       # PostHog initialization (import this first)
    ├── main.js          # Todo app logic with event tracking
    └── style.css        # App styles
```

## Key Implementation Patterns

### 1. Initialization (posthog.js)

```javascript
import posthog from 'posthog-js'

posthog.init('your-api-key', {
  api_host: 'https://us.i.posthog.com',
})
```

Initialize PostHog once, early in your app. All other modules import the same instance.

### 2. Event Tracking

```javascript
// Track events with properties — never send PII or user-generated content
posthog.capture('event_name', {
  item_count: 5,           // Metadata is OK
  action_type: 'create',   // Categories are OK
})
```

### 3. User Identification

```javascript
// On login — links events to a known user
posthog.identify('user_123')

// On logout — resets to a new anonymous distinct_id
posthog.reset()
```

### 4. Error Tracking

```javascript
// Global error handlers
window.addEventListener('error', (event) => {
  posthog.captureException(event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  posthog.captureException(event.reason)
})
```

## Running Without PostHog

The app works fine without PostHog configured. You'll see a console warning but the app continues to function normally.

## Next Steps

- Modify the app to experiment with PostHog tracking
- Explore feature flags: `posthog.isFeatureEnabled('flag-key')`
- Check your PostHog dashboard to see tracked events and autocaptured data
- Try session recording (enable in PostHog project settings)

## Learn More

- [PostHog JavaScript SDK Documentation](https://posthog.com/docs/libraries/js)
- [PostHog JavaScript SDK API Reference](https://posthog.com/docs/references/posthog-js)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
