# PostHog .NET example

This is an [ASP.NET Core](https://learn.microsoft.com/aspnet/core) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side [PostHog .NET SDK](https://posthog.com/docs/libraries/dotnet) and minimal APIs.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with a user via person properties; signed-out visitors get a random id and anonymous events
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Report handled exceptions to PostHog error tracking (the .NET SDK has no automatic exception capture yet, so exceptions are reported manually)
- **Server-side tracking**: All tracking happens server-side with the `PostHog.AspNetCore` package
- **Single client per app**: One PostHog client registered through dependency injection, flushed on shutdown

## Getting started

### 1. Install dependencies

```bash
dotnet add package PostHog.AspNetCore
```

Or restore the packages already listed in `PostHogExample.csproj`:

```bash
dotnet restore
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
dotnet run
```

Open [http://localhost:8000](http://localhost:8000) with your browser to see the app.

## Project structure

```
dotnet/
├── PostHogExample.csproj  # Project file and the PostHog.AspNetCore dependency
├── .env.example           # Environment variable template
├── .gitignore
├── Program.cs             # Entry point: app wiring
├── PostHogSetup.cs        # The single PostHog client (config from env)
└── Endpoints.cs           # Routes: identify, events, flags, error tracking
```

## Key integration points

### PostHog client (PostHogSetup.cs)

Register **one client per app** with `builder.AddPostHog()`. It adds `IPostHogClient` to the dependency injection container as a singleton, so inject it into handlers instead of creating clients yourself. The SDK batches events in the background.

```csharp
builder.AddPostHog();
```

### Configuration from the environment (PostHogSetup.cs)

`AddPostHog` reads the `PostHog` configuration section. Map `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` onto it so secrets never live in source. A blank token never breaks the app: the SDK disables itself and every call becomes a no-op. In Development the app also logs a warning that names the variable.

```csharp
builder.Configuration["PostHog:ProjectToken"] = projectToken;
builder.Configuration["PostHog:HostUrl"] = string.IsNullOrWhiteSpace(host)
    ? "https://us.i.posthog.com"
    : host;

builder.AddPostHog();
```

### User identification (Endpoints.cs)

The .NET SDK identifies a user by capturing an event with person properties. The distinct id is the stable user id and must match the id your frontend `identify` call uses.

```csharp
posthog.Capture(
    userId,
    "user_logged_in",
    properties: new() { ["login_method"] = "email" },
    personPropertiesToSet: new() { ["email"] = email },
    personPropertiesToSetOnce: new() { ["first_login_method"] = "email" });
```

### Signed-out visitors (Endpoints.cs)

The `Visitor` helper returns the distinct id and whether the visitor is anonymous. Signed-in users (a `user_id` cookie) keep their stable user id. For everyone else it generates a random GUID, stores it in an `anon_id` cookie so it is reused for the rest of the visit, and `EventProperties` sets `$process_person_profile` to `false` on their events so PostHog does not create a person profile for them.

```csharp
var (userId, anonymous) = Visitor(context);

posthog.Capture(
    userId,
    "burrito_considered",
    properties: EventProperties(anonymous, new() { ["total_considerations"] = count }));
```

Feature flags use the same visitor id, so flag evaluation works for anonymous visitors too.

### Event tracking (Endpoints.cs)

Capture a business event with the visitor's distinct id and an event property.

```csharp
posthog.Capture(
    userId,
    "burrito_considered",
    properties: EventProperties(anonymous, new() { ["total_considerations"] = count }));
```

### Feature flags (Endpoints.cs)

Evaluate flags once per request with `EvaluateFlagsAsync`, then read individual flags off the returned snapshot with `IsEnabled`. This is the current API; the per-flag helpers such as `IsFeatureEnabledAsync` are deprecated.

```csharp
var flags = await posthog.EvaluateFlagsAsync(
    userId,
    options: new AllFeatureFlagsOptions
    {
        FlagKeysToEvaluate = ["new-dashboard-feature"],
    });

var showNewFeature = flags.IsEnabled("new-dashboard-feature");
```

### Error tracking (Endpoints.cs)

Report a handled exception with `CaptureException`. It sends a `$exception` event with the stack frames and inner exceptions. Pass the distinct id and any extra properties.

```csharp
try
{
    RiskyOperation();
}
catch (Exception exception)
{
    posthog.CaptureException(
        exception,
        userId,
        new Dictionary<string, object> { ["route"] = "/profile" });
}
```

### Flush and shutdown (Program.cs)

The client is a DI singleton, so the host disposes it on shutdown (Ctrl+C or SIGTERM). Disposal flushes the queued events before the process exits, so no extra code is needed in a long-running ASP.NET Core app. In serverless environments, call `await posthog.FlushAsync()` after each request instead.

```csharp
app.Run();
```

## Reverse proxy

Server-side SDKs send events from your backend, so they don't need a reverse proxy. Only the browser SDK does.

## Learn more

- [PostHog .NET integration](https://posthog.com/docs/libraries/dotnet)
- [PostHog .NET error tracking](https://posthog.com/docs/error-tracking/installation/dotnet)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog documentation](https://posthog.com/docs)
- [ASP.NET Core documentation](https://learn.microsoft.com/aspnet/core)
