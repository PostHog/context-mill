# PostHog .NET example

A minimal console application showing PostHog integration for non-ASP.NET Core .NET applications such as CLIs, workers, MAUI, Blazor, and background services.

## What this demonstrates

- Creating a singleton `PostHogClient` with `PostHogOptions`
- Reading project token, host, and optional personal API key from environment variables
- Identifying a user with `IdentifyAsync`
- Capturing product analytics events with `Capture`
- Capturing handled exceptions with `CaptureException`
- Calling `FlushAsync` before process exit so queued events are delivered

## Run it

```bash
cp .env.example .env
export POSTHOG_PROJECT_TOKEN=phc_your_project_token_here
export POSTHOG_HOST=https://us.i.posthog.com

dotnet run -- "created todo"
```

## Key pattern

For non-web .NET processes, create one `PostHogClient` for the process lifetime and flush it during shutdown:

```csharp
await using var posthog = new PostHogClient(Options.Create(new PostHogOptions
{
    ProjectToken = Environment.GetEnvironmentVariable("POSTHOG_PROJECT_TOKEN"),
    HostUrl = new Uri(Environment.GetEnvironmentVariable("POSTHOG_HOST") ?? "https://us.i.posthog.com"),
}));

posthog.Capture("user_123", "order completed", properties, groups: null, flags: null);
await posthog.FlushAsync();
```
