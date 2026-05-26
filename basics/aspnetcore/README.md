# PostHog ASP.NET Core example

A minimal ASP.NET Core application showing PostHog integration with dependency injection, product analytics, manual error capture middleware, and Microsoft Feature Management backed by PostHog feature flags.

## What this demonstrates

- Registering `PostHog.AspNetCore` with `builder.AddPostHog()`
- Binding configuration from the `PostHog` section or environment variables
- Injecting `IPostHogClient` into endpoints
- Capturing user actions at API boundaries
- Capturing request exceptions without replacing existing error handling
- Enabling `Microsoft.FeatureManagement` via `UseFeatureManagement<TContextProvider>()`
- Providing distinct IDs and person properties through `PostHogFeatureFlagContextProvider`

## Run it

```bash
export POSTHOG_PROJECT_TOKEN=phc_your_project_token_here
export POSTHOG_HOST=https://us.i.posthog.com
# Optional, required only for local feature flag evaluation:
export POSTHOG_PERSONAL_API_KEY=phx_your_personal_api_key_here

dotnet run
```

Then call the example endpoints:

```bash
curl -X POST http://localhost:5000/api/todos \
  -H 'Content-Type: application/json' \
  -H 'X-POSTHOG-DISTINCT-ID: user_123' \
  -d '{"title":"Write docs"}'

curl http://localhost:5000/api/features/new-dashboard \
  -H 'X-POSTHOG-DISTINCT-ID: user_123'
```

## Key patterns

Use `PostHog.AspNetCore` for web apps instead of manually constructing clients in controllers. Register once at startup, inject `IPostHogClient`, and keep capture calls close to meaningful user actions.

For .NET Feature Management, implement `IPostHogFeatureFlagContextProvider` (or inherit from `PostHogFeatureFlagContextProvider`) so PostHog can evaluate flags with the current request's distinct ID, person properties, and groups.
