# PostHog Ruby Example - CLI Todo App

A simple command-line todo application built with plain Ruby (no frameworks) demonstrating PostHog integration for CLIs, scripts, data pipelines, and non-web Ruby applications.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain Ruby projects
- **Reference implementation** of PostHog best practices for non-framework Ruby code
- **Working example** you can run and modify

## Features Demonstrated

- **Instance-based API** - Uses `PostHog::Client.new(...)` for explicit client management
- **Proper shutdown** - Uses `shutdown` in `ensure` block to flush events before exit
- **Event tracking** - Captures user actions with `distinct_id` and properties
- **User identification** - Associates properties with users via `identify`
- **Error handling** - Manual exception capture for handled errors

## Quick Start

### 1. Install Dependencies

```bash
# Install bundler if needed
gem install bundler

# Install dependencies
bundle install
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
ruby todo.rb add "Buy groceries"

# List all todos
ruby todo.rb list

# Complete a todo
ruby todo.rb complete 1

# Delete a todo
ruby todo.rb delete 1

# Show statistics
ruby todo.rb stats
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
basics/ruby/
├── todo.rb              # Main CLI application
├── Gemfile              # Ruby dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Key Implementation Patterns

### 1. Instance-Based Initialization

```ruby
require 'posthog-ruby'

posthog = PostHog::Client.new(
  api_key: api_key,
  host: 'https://us.i.posthog.com',
  on_error: proc { |status, msg| puts "PostHog error: #{status} - #{msg}" }
)
```

### 2. Event Tracking Pattern

```ruby
# Track events with distinct_id
posthog.capture(
  distinct_id: 'user_123',
  event: 'event_name',
  properties: { key: 'value' }
)
```

### 3. Proper Shutdown

```ruby
begin
  # Your application code
ensure
  # Always call shutdown to flush events and close connections
  posthog&.shutdown
end
```

### 4. Identifying Users

```ruby
# Identify users (optional - adds user properties)
posthog.identify(
  distinct_id: 'user_123',
  properties: { email: 'user@example.com', plan: 'pro' }
)
```

## Running Without PostHog

The app works fine without PostHog configured - it simply won't track analytics. You'll see a warning message but the app continues to function normally.

## Next Steps

- Modify `todo.rb` to experiment with PostHog tracking
- Add new commands and track their usage
- Explore feature flags: `posthog.is_feature_enabled('flag-name', 'user_id')`
- Check your PostHog dashboard to see tracked events

## Learn More

- [PostHog Ruby SDK Documentation](https://posthog.com/docs/libraries/ruby)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
