# PostHog Ruby on Rails example

This is a [Ruby on Rails](https://rubyonrails.org) example demonstrating PostHog integration with product analytics, error tracking (auto-instrumentation), feature flags, user identification, and ActiveJob instrumentation via the `posthog-rails` gem.

## Features

- **Product analytics**: Track user events and behaviors with `PostHog.capture`
- **Error tracking (auto)**: Unhandled exceptions captured automatically by `posthog-rails`
- **Error tracking (manual)**: Handled errors captured with `PostHog.capture_exception`
- **Rails.error integration**: Rails 7+ error reporting captured automatically
- **ActiveJob instrumentation**: Background job failures captured automatically
- **User identification**: Associate events with authenticated users via `PostHog.identify`
- **Feature flags**: Control feature rollouts with `PostHog.is_feature_enabled`
- **User context**: Exceptions automatically associated with `current_user`
- **Frontend tracking**: posthog-js captures pageviews and session replay alongside backend events

## Getting started

### 1. Install dependencies

```bash
bundle install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and add your PostHog API key
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Setup database

```bash
bin/rails db:create db:migrate db:seed
```

### 4. Run the development server

```bash
bin/rails server
```

Open [http://localhost:3000](http://localhost:3000) with your browser. Login with `admin@example.com` / `admin`.

## Project structure

```
ruby-on-rails/
├── config/
│   ├── routes.rb                        # URL routing
│   └── initializers/
│       └── posthog.rb                   # PostHog + posthog-rails configuration
├── app/
│   ├── controllers/
│   │   ├── application_controller.rb    # Base controller with current_user
│   │   ├── sessions_controller.rb       # Login/logout with PostHog identify
│   │   ├── registrations_controller.rb  # Signup with PostHog identify
│   │   ├── dashboard_controller.rb      # Feature flags + ActiveJob demo
│   │   ├── burritos_controller.rb       # Custom event tracking
│   │   ├── profiles_controller.rb       # Page view tracking
│   │   └── errors_controller.rb         # Error tracking demos
│   ├── jobs/
│   │   └── example_job.rb              # ActiveJob auto-instrumentation demo
│   ├── models/
│   │   └── user.rb                     # posthog_distinct_id + posthog_properties
│   └── views/
│       ├── layouts/application.html.erb # Base layout with posthog-js snippet
│       ├── sessions/new.html.erb        # Login page
│       ├── registrations/new.html.erb   # Signup page
│       ├── dashboard/show.html.erb      # Feature flags demo
│       ├── burritos/show.html.erb       # Event tracking demo
│       └── profiles/show.html.erb       # Error tracking demo
├── db/
│   ├── migrate/                         # Database migrations
│   └── seeds.rb                         # Default admin user
├── .env.example                         # Environment variable template
├── Gemfile                              # Ruby dependencies
└── README.md                            # This file
```

## Key integration points

### PostHog initialization (config/initializers/posthog.rb)

```ruby
# Rails-specific auto-instrumentation
PostHog::Rails.configure do |config|
  config.auto_capture_exceptions = true
  config.report_rescued_exceptions = true
  config.auto_instrument_active_job = true
  config.capture_user_context = true
  config.current_user_method = :current_user
  config.user_id_method = :posthog_distinct_id
end

PostHog.init do |config|
  config.api_key = ENV.fetch('POSTHOG_API_KEY', nil)
  config.host = ENV.fetch('POSTHOG_HOST', 'https://us.i.posthog.com')
end
```

### User model (app/models/user.rb)

```ruby
class User < ApplicationRecord
  has_secure_password

  # Called by posthog-rails for automatic user association in error reports
  def posthog_distinct_id
    email
  end

  def posthog_properties
    { email: email, is_staff: is_staff, date_joined: created_at&.iso8601 }
  end
end
```

### User identification (app/controllers/sessions_controller.rb)

```ruby
# Identify the user and capture login event
PostHog.identify(
  distinct_id: user.posthog_distinct_id,
  properties: user.posthog_properties
)

PostHog.capture(
  distinct_id: user.posthog_distinct_id,
  event: 'user_logged_in',
  properties: { login_method: 'email' }
)
```

### Feature flags (app/controllers/dashboard_controller.rb)

```ruby
# Check if a feature flag is enabled
@show_new_feature = PostHog.is_feature_enabled(
  'new-dashboard-feature',
  user.posthog_distinct_id,
  person_properties: user.posthog_properties
)

# Get feature flag payload for configuration
@feature_config = PostHog.get_feature_flag_payload(
  'new-dashboard-feature',
  user.posthog_distinct_id
)
```

### Error tracking — auto-capture

With `auto_capture_exceptions: true`, unhandled exceptions in controllers are captured automatically. No code needed:

```ruby
# This exception is automatically captured by posthog-rails
# with the current_user's posthog_distinct_id attached
def show
  raise "Something went wrong"  # Captured automatically!
end
```

### Error tracking — manual capture

```ruby
begin
  risky_operation
rescue => e
  PostHog.capture_exception(e, current_user.posthog_distinct_id)
end
```

### Error tracking — Rails.error integration

```ruby
# posthog-rails subscribes to Rails.error automatically
Rails.error.handle(context: { user_id: user.id }) do
  risky_operation
end
```

### ActiveJob instrumentation

```ruby
# config: auto_instrument_active_job = true
# Job failures are captured automatically.
# Use the posthog_distinct_id DSL to associate errors with a user.
class ExampleJob < ApplicationJob
  posthog_distinct_id ->(distinct_id, *) { distinct_id }

  def perform(distinct_id, should_fail: false)
    raise "Job failed"  # Captured automatically with user context
  end
end

# In the controller, pass the distinct_id when enqueuing:
ExampleJob.perform_later(current_user.posthog_distinct_id, should_fail: true)
```

## Frontend + Backend integration

This example includes the posthog-js snippet in the layout template to demonstrate how frontend and backend tracking work together.

### How it works

1. **posthog-js** (frontend) captures pageviews, clicks, and session replay
2. **posthog-ruby + posthog-rails** (backend) captures business logic events, errors, and feature flag evaluations
3. **Shared distinct_id** — frontend and backend events are linked when the same `distinct_id` is used on both sides. Call `posthog.identify(user.email)` in posthog-js after login, matching the `posthog_distinct_id` used on the backend
4. **Session replay** lets you watch user sessions where errors occurred

**Note:** Unlike the Django SDK, posthog-rails does not include a context middleware that reads `X-POSTHOG-SESSION-ID` or `X-POSTHOG-DISTINCT-ID` tracing headers. Frontend and backend events are correlated through the shared `distinct_id`.

### When to track frontend vs backend

- **Frontend**: UI interactions, client-side errors, session replay, pageviews
- **Backend**: Business logic (signups, purchases), server errors, feature flag evaluations, background jobs

## Learn more

- [PostHog Ruby on Rails integration](https://posthog.com/docs/libraries/ruby-on-rails)
- [PostHog Ruby SDK](https://posthog.com/docs/libraries/ruby)
- [PostHog Error Tracking](https://posthog.com/docs/error-tracking)
- [Ruby on Rails documentation](https://guides.rubyonrails.org/)
