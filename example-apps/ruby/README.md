# PostHog Ruby Example - CLI Todo App

A simple command-line todo application built with plain Ruby (no frameworks) demonstrating PostHog integration for CLIs, scripts, data pipelines, and non-web Ruby applications.

## Purpose

This example serves as:
- **Verification** that the context-mill wizard works for plain Ruby projects
- **Reference implementation** of PostHog best practices for non-framework Ruby code
- **Working example** you can run and modify

## Features Demonstrated

- **Instance-based API**: Uses `PostHog::Client.new(...)` for explicit client management
- **Proper shutdown**: Calls `shutdown` safely in an `ensure` block to flush events before exit
- **Event tracking**: Captures user actions with a persistent `distinct_id` and non-PII properties
- **User identification**: Associates person properties with users via `identify`
- **Error handling**: Manual exception capture for handled errors

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

# Edit .env and set POSTHOG_PROJECT_TOKEN
# POSTHOG_PROJECT_TOKEN=
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
example-apps/ruby/
├── todo.rb              # Main CLI application
├── Gemfile              # Ruby dependencies
├── .env.example         # Environment variable template
├── .gitignore           # Git ignore rules
└── README.md            # This file
```

## Key Implementation Patterns

### 1. Instance-Based Initialization

```ruby
require 'posthog'

project_token = ENV['POSTHOG_PROJECT_TOKEN']&.strip
posthog = if project_token.nil? || project_token.empty?
            nil
          else
            PostHog::Client.new(
              api_key: project_token,
              host: ENV.fetch('POSTHOG_HOST', 'https://us.i.posthog.com'),
              on_error: proc { |status, msg| $stderr.puts "PostHog error: #{status} - #{msg}" }
            )
          end
```

### 2. Event Tracking Pattern

```ruby
posthog&.capture(
  distinct_id: user_id,
  event: 'todo_added',
  properties: { todo_id: 1, todo_length: 13, total_todos: 1 }
)
```

### 3. Proper Shutdown

```ruby
begin
  # Your application code
ensure
  begin
    posthog&.shutdown
  rescue StandardError
    nil
  end
end
```

### 4. Identifying Users

```ruby
posthog&.identify(
  distinct_id: user_id,
  properties: { email: 'user@example.com', plan: 'pro' }
)
```

## Running Without PostHog

When `POSTHOG_PROJECT_TOKEN` is unset, the CLI logs a warning to `stderr` outside production, skips client initialization, and runs todos normally.

## Next Steps

- Modify `todo.rb` to experiment with PostHog tracking
- Add new commands and track their usage
- Explore feature flags: `posthog.is_feature_enabled('flag-name', user_id)`
- Check your PostHog dashboard to see tracked events

## Learn More

- [PostHog Ruby SDK Documentation](https://posthog.com/docs/libraries/ruby)
- [PostHog Product Analytics](https://posthog.com/docs/product-analytics)
