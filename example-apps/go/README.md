# PostHog Go example

This is a [Go](https://go.dev) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side Go SDK and the standard library `net/http`.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with a user via person properties (`$set`)
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Report exceptions to PostHog error tracking
- **Server-side tracking**: All tracking happens server-side with the `posthog-go` SDK
- **Single client per process**: One PostHog client for the whole app, flushed on shutdown

## Getting started

### 1. Install dependencies

```bash
go get github.com/posthog/posthog-go
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
├── main.go           # Entry point: server wiring + graceful shutdown
├── posthog.go        # The single PostHog client (config from env)
└── handlers.go       # Routes: identify, events, flags, error tracking
```

## Key integration points

### PostHog client (posthog.go)

Create **one client per process** with `posthog.NewWithConfig` and share it across every request. Never construct a new client per request — the SDK batches events on a background goroutine.

```go
client, err := posthog.NewWithConfig(projectToken, posthog.Config{
    Endpoint: host,
})
```

### Configuration from the environment (posthog.go)

Read the token and host from the environment so secrets never live in source. A blank token logs a clear warning and the app keeps running.

```go
projectToken := os.Getenv("POSTHOG_PROJECT_TOKEN")

host := os.Getenv("POSTHOG_HOST")
if host == "" {
    host = "https://us.i.posthog.com"
}

if projectToken == "" {
    log.Println("WARNING: POSTHOG_PROJECT_TOKEN is not set. PostHog events will not be delivered.")
}
```

### User identification (handlers.go)

The Go SDK identifies a user by capturing an event whose properties include `$set` (person properties). The `DistinctId` is the stable user id and must match the id your frontend `identify` call uses.

```go
client.Enqueue(posthog.Capture{
    DistinctId: userId,
    Event:      "user_logged_in",
    Properties: posthog.NewProperties().
        Set("login_method", "email").
        Set("$set", map[string]any{"email": email}),
})
```

### Event tracking (handlers.go)

Capture a business event with a stable distinct id and a couple of event properties.

```go
client.Enqueue(posthog.Capture{
    DistinctId: userId,
    Event:      "burrito_considered",
    Properties: posthog.NewProperties().
        Set("total_considerations", count),
})
```

### Feature flags (handlers.go)

Evaluate flags once per request with `EvaluateFlags`, then read individual flags off the returned snapshot with `IsEnabled`. This is the current API — avoid the deprecated per-flag helpers.

```go
flags, err := client.EvaluateFlags(posthog.EvaluateFlagsPayload{
    DistinctId: userId,
    FlagKeys:   []string{"new-dashboard-feature"},
})
if err == nil {
    showNewFeature := flags.IsEnabled("new-dashboard-feature")
    // ... branch on showNewFeature
}
```

### Error tracking (handlers.go)

Report an exception with `posthog.NewDefaultException` (timestamp, distinct id, exception type, message) and enqueue it like any other event.

```go
if err := riskyOperation(); err != nil {
    exception := posthog.NewDefaultException(
        time.Now(),
        userId,
        "ProfileDataError",
        err.Error(),
    )
    client.Enqueue(exception)
}
```

### Flush and shutdown (main.go)

Call `client.Close()` on shutdown so the background batch of queued events is flushed before the process exits. Here it is wired to `SIGINT`/`SIGTERM`.

```go
stop := make(chan os.Signal, 1)
signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
<-stop

if err := client.Close(); err != nil {
    log.Printf("error closing PostHog client: %v", err)
}
```

## Learn more

- [PostHog Go integration](https://posthog.com/docs/libraries/go)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog error tracking](https://posthog.com/docs/error-tracking)
- [PostHog documentation](https://posthog.com/docs)
- [Go documentation](https://go.dev/doc/)
