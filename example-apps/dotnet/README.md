# PostHog .NET example

This is an [ASP.NET Core](https://learn.microsoft.com/aspnet/core) example demonstrating PostHog integration with product analytics, feature flags, user identification, and error tracking using the server-side [PostHog .NET SDK](https://posthog.com/docs/libraries/dotnet) and minimal APIs.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with a stable UUID via `IdentifyAsync` and person properties, while signed-out visitors get a random cookie UUID and personless events
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Error tracking**: Report handled exceptions to PostHog error tracking (the .NET SDK has no automatic exception capture yet, so exceptions are reported manually)
- **Server-side tracking**: All tracking happens server-side with the `PostHog.AspNetCore` package
- **Single client per app**: One PostHog client registered through dependency injection when configured, flushed on shutdown

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
├── PostHogSetup.cs        # Conditional PostHog singleton registration from env
└── Endpoints.cs           # Routes: login, logout, events, flags, error tracking
```

## Key integration points

### PostHog client and configuration (PostHogSetup.cs)

Register **one client per app** with `builder.AddPostHog()` only when `POSTHOG_PROJECT_TOKEN` is non-empty. Never register the SDK with a blank or placeholder token. Outside Production, `WarnIfPostHogUnconfigured` logs a warning when `POSTHOG_PROJECT_TOKEN` is missing, and route handlers resolve `IPostHogClient?` optionally via `context.RequestServices.GetService<IPostHogClient>()` so the app runs cleanly without credentials.

```csharp
var projectToken = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_TOKEN")?.Trim();
if (string.IsNullOrWhiteSpace(projectToken))
{
    return false;
}

var host = Environment.GetEnvironmentVariable("POSTHOG_HOST")?.Trim();
builder.Configuration["PostHog:ProjectToken"] = projectToken;
builder.Configuration["PostHog:HostUrl"] = string.IsNullOrWhiteSpace(host)
    ? "https://us.i.posthog.com"
    : host;

builder.AddPostHog();
```

### User identification (Endpoints.cs)

Require a non-empty `email` or `username` on `POST /login` and return `400 Bad Request` when blank rather than falling back to a shared literal id. Map each login account to a stable `Guid`, store that UUID in the `user_id` cookie, call `IdentifyAsync` with person properties, and capture `user_logged_in` without PII in event properties.

```csharp
var userId = UsersByAccount.GetOrAdd(accountKey, _ => Guid.NewGuid().ToString());
var posthog = context.RequestServices.GetService<IPostHogClient>();
if (posthog is not null)
{
    await posthog.IdentifyAsync(
        userId,
        personPropertiesToSet: personProperties,
        personPropertiesToSetOnce: new Dictionary<string, object>
        {
            ["first_login_method"] = loginMethod,
        },
        cancellationToken: context.RequestAborted);

    posthog.Capture(
        userId,
        "user_logged_in",
        properties: new Dictionary<string, object> { ["login_method"] = loginMethod });
}
```

### Signed-out visitors (Endpoints.cs)

The `Visitor` helper returns the distinct id and whether the visitor is anonymous. Signed-in users (a `user_id` cookie) keep their stable UUID. For everyone else it generates a random GUID, stores it in an `anon_id` cookie so it is reused for the rest of the visit, and `EventProperties` sets `$process_person_profile` to `false` on their events so PostHog does not create a person profile for them.

```csharp
var (userId, anonymous) = Visitor(context);
var posthog = context.RequestServices.GetService<IPostHogClient>();

posthog?.Capture(
    userId,
    "burrito_considered",
    properties: EventProperties(anonymous, new() { ["total_considerations"] = count }));
```

Feature flags use the same visitor id, so flag evaluation works for anonymous visitors too.

### Event tracking (Endpoints.cs)

Capture a business event with the visitor's distinct id and non-PII event properties.

```csharp
posthog?.Capture(
    userId,
    "burrito_considered",
    properties: EventProperties(anonymous, new() { ["total_considerations"] = count }));
```

### Feature flags (Endpoints.cs)

Evaluate flags once per request with `EvaluateFlagsAsync`, then read individual flags off the returned snapshot with `IsEnabled`. This is the current API, and the per-flag helpers such as `IsFeatureEnabledAsync` are deprecated.

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
    posthog?.CaptureException(
        exception,
        userId,
        EventProperties(anonymous, new() { ["route"] = "/profile" }));
}
```

### Flush and shutdown (Program.cs)

The client is a DI singleton when configured, so the host disposes it on shutdown (Ctrl+C or SIGTERM). Disposal flushes the queued events before the process exits, so no extra code is needed in a long-running ASP.NET Core app. In serverless environments, call `await posthog.FlushAsync()` after each request instead.

```csharp
app.WarnIfPostHogUnconfigured();
app.MapBurritoEndpoints();
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
