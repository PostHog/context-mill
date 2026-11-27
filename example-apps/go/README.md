# PostHog Go example

This is a [Go](https://go.dev) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side Go SDK and the standard library `net/http`.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with a stable UUID via person properties (`$set`), while signed-out visitors get a random cookie UUID and personless events
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Report exceptions to PostHog error tracking
- **Server-side tracking**: All tracking happens server-side with the `posthog-go` SDK
- **Single client per process**: One PostHog client for the whole app when configured, flushed on shutdown

## Getting started

### 1. Install dependencies

```bash
go get github.com/posthog/posthog-go/v2
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your values, then export them:

```bash
export POSTHOG_PROJECT_TOKEN=your_posthog_project_token
export POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the app

```bash
go run .
```

Open [http://localhost:8000](http://localhost:8000) with your browser to see the app.

## Project structure

```
go/
├── go.mod            # Module definition and the posthog-go dependency
├── .env.example      # Environment variable template
├── .gitignore
├── main.go           # Entry point: server wiring and graceful shutdown
├── posthog.go        # Optional process-wide PostHog client from env
└── handlers.go       # Routes: login, logout, events, flags, error tracking
```

## Key integration points

### PostHog client and configuration (posthog.go)

Read `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from the environment so secrets never live in source. When `POSTHOG_PROJECT_TOKEN` is missing or blank, log a warning outside production and return `nil, nil` instead of calling `posthog.NewWithConfig` with an empty token. When configured, create **one client per process** and share it across every request handler.

```go
projectToken := strings.TrimSpace(os.Getenv("POSTHOG_PROJECT_TOKEN"))
if projectToken == "" {
    if os.Getenv("GO_ENV") != "production" && os.Getenv("APP_ENV") != "production" {
        slog.Warn("POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured")
    }
    return nil, nil
}

host := strings.TrimSpace(os.Getenv("POSTHOG_HOST"))
if host == "" {
    host = "https://us.i.posthog.com"
}

client, err := posthog.NewWithConfig(projectToken, posthog.Config{
    Endpoint: host,
})
```

### User identification (handlers.go)

Validate login input and return `400 Bad Request` when blank rather than falling back to a shared placeholder id. Map each login account to a stable UUID stored in memory, keep that UUID in the `user_id` cookie, and set person properties via `$set` on `user_logged_in` without putting PII in event properties.

```go
userID := a.userIDForAccount(accountKey)

if a.posthog != nil {
    _ = a.posthog.Enqueue(posthog.Capture{
        DistinctId: userID,
        Event:      "user_logged_in",
        Properties: posthog.NewProperties().
            Set("login_method", loginMethod).
            Set("$set", personProps),
    })
}
```

### Signed-out visitors (handlers.go)

The `visitor` helper returns the distinct id and whether the visitor is anonymous. Signed-in users (a `user_id` cookie) keep their stable UUID. For everyone else it generates a random UUID, stores it in an `anon_id` cookie so it is reused for the rest of the visit, and the `options` helper sets the `process_person_profile` option to `false` so PostHog does not create a person profile for them.

```go
userId, anonymous := visitor(w, r)

if a.posthog != nil {
    _ = a.posthog.Enqueue(posthog.Capture{
        DistinctId: userId,
        Event:      "burrito_considered",
        Options:    options(anonymous),
    })
}
```

Feature flags use the same visitor id, so flag evaluation works for anonymous visitors too.

### Event tracking (handlers.go)

Capture a business event with the visitor's distinct id, non-PII event properties via `posthog.NewProperties()`, and `options(anonymous)`.

```go
if a.posthog != nil {
    _ = a.posthog.Enqueue(posthog.Capture{
        DistinctId: userId,
        Event:      "burrito_considered",
        Properties: posthog.NewProperties().
            Set("total_considerations", count),
        Options: options(anonymous),
    })
}
```

### Feature flags (handlers.go)

Evaluate flags once per request with `EvaluateFlags`, then read individual flags off the returned snapshot with `IsEnabled`. This is the current API, so avoid the deprecated per-flag helpers.

```go
if a.posthog != nil {
    flags, err := a.posthog.EvaluateFlags(posthog.EvaluateFlagsPayload{
        DistinctId: userId,
        FlagKeys:   []string{"new-dashboard-feature"},
    })
    if err == nil {
        showNewFeature = flags.IsEnabled("new-dashboard-feature")
    }
}
```

### Error tracking (handlers.go)

Report an exception with `posthog.NewDefaultException` (timestamp, distinct id, exception type, message) and enqueue it when the PostHog client is configured.

```go
if err := riskyOperation(); err != nil && a.posthog != nil {
    exception := posthog.NewDefaultException(
        time.Now(),
        userId,
        "ProfileDataError",
        err.Error(),
    )
    exception.Options = options(anonymous)
    _ = a.posthog.Enqueue(exception)
}
```

### Flush and shutdown (main.go)

Call `client.Close()` on shutdown when `client != nil` so the background batch of queued events is flushed before the process exits. Here it is wired to `SIGINT` and `SIGTERM`.

```go
stop := make(chan os.Signal, 1)
signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
<-stop

if client != nil {
    if err := client.Close(); err != nil {
        log.Printf("error closing PostHog client: %v", err)
    }
}
```

## Learn more

- [PostHog Go integration](https://posthog.com/docs/libraries/go)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog error tracking](https://posthog.com/docs/error-tracking)
- [PostHog documentation](https://posthog.com/docs)
- [Go documentation](https://go.dev/doc/)
