# PostHog Ruby on Rails example

This is a [Ruby on Rails](https://rubyonrails.org) example demonstrating PostHog integration with product analytics, error tracking (auto-instrumentation), feature flags, user identification, and ActiveJob instrumentation via the `posthog-rails` gem.

## Features

- **Product analytics**: Track user events and behaviors with `PostHog.capture`
- **Error tracking (auto)**: Unhandled exceptions captured automatically by `posthog-rails`
- **Error tracking (manual)**: Handled errors captured with `PostHog.capture_exception`
- **Rails.error integration**: Rails 7+ error reporting captured automatically
- **ActiveJob instrumentation**: Background job failures captured automatically
- **User identification**: Associate events with authenticated users via `PostHog.identify`
- **Feature flags**: Control feature rollouts with `PostHog.evaluate_flags`
- **User context**: Exceptions automatically associated with `current_user`
- **Request context**: request metadata (and, from the browser, the PostHog session and distinct ID) attached to backend events
- **Frontend tracking**: posthog-js captures pageviews and session replay alongside backend events

## Getting started

### 1. Install dependencies

```bash
bundle install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env and add your PostHog project token
```

If `POSTHOG_PROJECT_TOKEN` is missing the app still boots: PostHog stays disabled, every PostHog call is a no-op, and development logs a warning naming the variable.

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

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
PostHog::Rails.configure do |config|
  config.auto_capture_exceptions = true
  config.report_rescued_exceptions = true
  config.auto_instrument_active_job = true
  config.capture_user_context = true
  config.current_user_method = :current_user
  config.user_id_method = :posthog_distinct_id
end

project_token = ENV['POSTHOG_PROJECT_TOKEN'].to_s.strip

if project_token.empty?
  Rails.logger.warn('POSTHOG_PROJECT_TOKEN is not set; PostHog is disabled...') if Rails.env.development?
else
  PostHog.init do |config|
    config.api_key = project_token
    config.host = ENV.fetch('POSTHOG_HOST', 'https://us.i.posthog.com')
    config.test_mode = true if Rails.env.test?
  end
end
```

The Gemfile lists both gems: `posthog-ruby` (with `require: 'posthog'`) and `posthog-rails`. `rails generate posthog:install` creates an initializer like this one. `PostHog.init` creates the single shared client; do not create more `PostHog::Client` instances with the same key.

## What the integration sets up for you

Everything below comes from `posthog-rails` (the Railtie in its `railtie.rb`) and its documented behavior. The three `PostHog::Rails` exception and job options default to `false`, so the initializer turns them on.

### Automatic

- **`PostHog` facade**: `PostHog.init`, `PostHog.capture`, `PostHog.identify`, `PostHog.capture_exception`, `PostHog.evaluate_flags` and the other client methods are available on the `PostHog` module. If `PostHog.init` is never called, calls hit a disabled client and do nothing.
- **Request context** (`PostHog::Rails::RequestContext` middleware, inserted before `ActionDispatch::ShowExceptions`): every event captured during a web request gets `$current_url`, `$request_method`, `$request_path`, `$user_agent` and `$ip`. With `use_tracing_headers` (default `true`), the `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` request headers become the default `distinct_id` and `$session_id`. A `distinct_id` you pass explicitly always wins. These headers are client-controlled, so pass the authenticated ID yourself for anything security-sensitive.
- **Exception capture** (`CaptureExceptions` middleware, with `auto_capture_exceptions`): unhandled controller exceptions are sent as `$exception` events with the controller, action, filtered request params, response status and referrer. `RescuedExceptionInterceptor` (with `report_rescued_exceptions`) also reports exceptions Rails rescues and renders as error pages. Common 4xx exceptions (`ActiveRecord::RecordNotFound`, `ActionController::RoutingError`, `ActionController::ParameterMissing` and others) are excluded by default; add more with `config.excluded_exceptions`.
- **User context**: for captured exceptions, `capture_user_context` calls `current_user_method` on the controller and reads the distinct ID from the user. `user_id_method` wins when set; otherwise it tries `posthog_distinct_id`, `distinct_id`, `id`, `pk`, then `uuid`. This app sets `posthog_distinct_id` on `User` so the ID matches the one used for identify and for the browser.
- **`Rails.error` subscriber** (Rails 7+, needs `auto_capture_exceptions` and an initialized client): errors reported through `Rails.error.handle`, `Rails.error.record` and `Rails.error.report` are captured. `user_id` or `distinct_id` in the context hash becomes the distinct ID; other context keys become `$context_*` properties.
- **ActiveJob** (with `auto_instrument_active_job`): job failures are captured with `$job_class`, `$job_id`, `$queue_name` and sanitized arguments. The enqueuing request's distinct ID and session ID travel inside the job payload. A `posthog_distinct_id` class method on the job, or a `user_id` key in a hash argument, sets the ID for the job.
- **Action Cable** connections and channels are instrumented by the same Railtie.
- **Shutdown**: the Railtie registers an `at_exit` hook that calls `shutdown` on the client, which flushes queued events. No manual flush is needed on normal exit.

### What the app still does itself

- Calls `PostHog.identify` once at login and signup (`sessions_controller.rb`, `registrations_controller.rb`) to set person properties.
- Calls `PostHog.capture` for its own events; the SDK does not capture pageviews or business events on the server.
- Evaluates feature flags with `PostHog.evaluate_flags` and passes the user's distinct ID.
- Defines `posthog_distinct_id` on `User` and sets `current_user` in `ApplicationController`.
- Calls `PostHog.capture_exception` for errors it rescues itself.
- Passes the distinct ID to jobs.
- Runs `posthog.identify` in the browser with the same ID, and sets the `tracing_headers` hostname (see the layout).

### User model (app/models/user.rb)

```ruby
class User < ApplicationRecord
  has_secure_password

  # Called by posthog-rails for automatic user association in error reports.
  # The primary key, not the email — an email can change, which splits one
  # person's history in two, and it is PII on every event's identity.
  def posthog_distinct_id
    id.to_s
  end

  def posthog_properties
    { email: email, is_staff: is_staff, date_joined: created_at&.iso8601 }
  end
end
```

### User identification and signed-out visitors (app/controllers/sessions_controller.rb)

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

Every `PostHog.capture` in this app runs for a signed-in user, whose stable id is `posthog_distinct_id`, so the app never invents an id for a visitor. When a server event has no `distinct_id` (for example an exception on a signed-out request), posthog-ruby uses the request's `X-POSTHOG-DISTINCT-ID` header (the browser's own anonymous id, sent because of `tracing_headers`). If there is none, it generates a random UUID and sets `$process_person_profile: false` on the event, so signed-out visitors are never merged into one person. Do not pass a shared literal such as `"anonymous"` as the `distinct_id` ([anonymous vs identified events](https://posthog.com/docs/data/anonymous-vs-identified-events.md)).

### Feature flags (app/controllers/dashboard_controller.rb)

```ruby
# Evaluate flags once, then read values from the snapshot
flags = PostHog.evaluate_flags(
  user.posthog_distinct_id,
  person_properties: user.posthog_properties
)
@show_new_feature = flags.enabled?('new-dashboard-feature')
@feature_config = flags.get_flag_payload('new-dashboard-feature')
```

`PostHog.is_feature_enabled` and `get_feature_flag_payload` still work but are deprecated in favor of `evaluate_flags`.

### Error tracking — auto-capture

With `auto_capture_exceptions = true`, unhandled exceptions in controllers are captured automatically. No code needed:

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
3. **Shared distinct_id** — frontend and backend events are linked when the same `distinct_id` is used on both sides. Call `posthog.identify(user.id.to_s)` in posthog-js after login, matching the `posthog_distinct_id` used on the backend
4. **Session replay** lets you watch user sessions where errors occurred

The layout sets `tracing_headers` so posthog-js adds `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` to requests to this app (needs posthog-js 1.380.0 or later). posthog-rails reads those headers in its request context, so backend events join the browser session even before a login.

The layout loads posthog-js only when `POSTHOG_PROJECT_TOKEN` is set, and passes `defaults: '2026-08-30'` so the SDK uses the current recommended behavior.

### When to track frontend vs backend

- **Frontend**: UI interactions, client-side errors, session replay, pageviews
- **Backend**: Business logic (signups, purchases), server errors, feature flag evaluations, background jobs

## Reverse proxy

Ad blockers block requests to known analytics domains, so browser events sent straight to PostHog can be lost. A reverse proxy sends them through a subdomain you own instead. The simplest option is the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md): create it in your organization's proxy settings, add the CNAME record it gives you, and wait for it to go live. Then set `api_host` in the layout's `posthog.init` call to your proxy URL and add `ui_host` (`https://us.posthog.com` or `https://eu.posthog.com`) so the toolbar still works. Leave `POSTHOG_HOST` on the PostHog ingestion host: server-side events from posthog-ruby are not subject to browser ad blockers. PostHog's proxy docs have no Rails-specific pattern, so this example adds no proxy code.

## Learn more

- [PostHog Ruby on Rails integration](https://posthog.com/docs/libraries/ruby-on-rails)
- [posthog-rails source](https://github.com/PostHog/posthog-ruby/tree/main/posthog-rails)
- [PostHog Ruby SDK](https://posthog.com/docs/libraries/ruby)
- [PostHog Error Tracking](https://posthog.com/docs/error-tracking)
- [Ruby on Rails documentation](https://guides.rubyonrails.org/)
