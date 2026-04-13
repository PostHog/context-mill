# PostHog best practices

Here are some best practices to get the most out of your PostHog integration.

## Reference files

{references}

## Key principles

- **No PII in events**: Never put emails, names, phone numbers, addresses, IPs, or user-generated content in `capture()` event properties. PII belongs in `identify()` person properties.
- **Project tokens vs personal API keys**: Project tokens starting with `phc_` are public and can be exposed in frontend code. Personal API keys starting with `phx_` are private and should NEVER be exposed in frontend code.
- **Analytics contract**: Treat event names, property names, and feature flag keys as a contract. Reuse existing names before inventing new ones; keep new ones clear, descriptive, and consistent with project conventions. Don't scatter the same flag or property across unrelated callsites.
- **Identify on login, reset on logout**: Call `identify(userId, ...)` on login and on refresh if already logged in. Call `reset()` on logout. Identify on a stable identifier that's consistent across sessions and your codebase.
- **Right SDK for the runtime**: Use the client SDK (e.g. `posthog-js`) in the browser and the server SDK (e.g. `posthog-node`, `posthog` for Python) on the server. Never mix.
- **Enable exception autocapture** wherever the SDK supports it.
- **Capture in event handlers, not effects**: Place `capture()` calls where the user action happens, not in reactive effects that mirror state.
- **Initialize once, early**: Init PostHog a single time at app startup, before any other PostHog calls.
- **Don't disable autocapture** unless the user explicitly asks.
- **Flush before exit**: In CLIs, scripts, and serverless handlers, call `shutdown()` (or equivalent) before exit or events are lost.
- **Minimal, targeted edits**: Add PostHog alongside existing logic. Preserve existing structure and style. No broad refactors, reformatting, or unrelated changes.
- **Don't assume a Provider is needed**: Only wrap the app in a `PostHogProvider` (or equivalent) if the specific framework actually requires it. Don't add one reflexively.

## Framework guidelines

### React

- Use `useFeatureFlagEnabled()` / `useFeatureFlagPayload()` — they handle loading and external sync automatically.
- Put `capture()` calls in event handlers, not in `useEffect`. `useEffect` is only for syncing with external systems.
- Don't use `useEffect` for derived values, chained state updates, or parent notification — do those in the handler.

### Next.js

- For Next.js 15.3+, initialize PostHog in `instrumentation-client.ts`.
- Client hooks work without `PostHogProvider` if `posthog-js` is already initialized globally.
- Server Components and Route Handlers can't use React hooks — use `posthog-node` and pass flag values to client components as props to avoid hydration mismatches and flicker.

### TanStack Router / Start

- Use the router's built-in navigation events for pageview tracking, not `useEffect`.
- Put `PostHogProvider` in the root route (`__root.tsx` or wherever `createRootRoute()` is called).
- For TanStack Start, use `posthog-node` in `src/routes/api/` as a singleton — never `posthog-js` on the server.

### SvelteKit

- Set `paths.relative: false` in `svelte.config.js` — required for session replay with SSR.
- Run `svelte-autofixer` on new or modified `.svelte` files before finishing.

### Astro

- Use `is:inline` on PostHog script tags to stop Astro from processing them.
- Prefix client-side env vars with `PUBLIC_` (e.g. `PUBLIC_POSTHOG_PROJECT_TOKEN`).
- With View Transitions, guard init with `window.__posthog_initialized` and use `capture_pageview: 'history_change'`.
- For SSR / hybrid, use `posthog-node` in `src/pages/api/` as a singleton.

### Angular

- Use `inject()` — not constructor injection — for a singleton root `PosthogService` wrapping the SDK.
- Prefer standalone components over NgModules.
- Put credentials in `src/environments/environment.ts`.

### React Native & Expo

- Package is `posthog-react-native` for both. `react-native-svg` is a required peer dependency.
- Bare RN: load env via `react-native-config`. Expo: use `expo-constants` + `app.config.js` extras.
- Place `PostHogProvider` inside `NavigationContainer` (RN v7) or in `app/_layout.tsx` (expo-router), and call `posthog.screen()` manually for expo-router.

### Node.js (posthog-node)

- Include `enableExceptionAutocapture: true` and install an error-handler hook (Express middleware, Fastify `setErrorHandler`, Koa `app.on('error')`).
- Don't touch `flushAt` / `flushInterval` in long-running servers. In short-lived processes, set both to send immediately.
- No reverse proxy needed for server-side — only browser JS needs one.

### Python

- Use the `Posthog()` class constructor (instance API), not the module-level config.
- Always set `enable_exception_autocapture=True`.
- No `identify()` method — use `posthog_client.set(distinct_id=..., properties={...})` or `identify_context(user_id)`.
- In scripts / CLIs, register `posthog_client.shutdown` with `atexit` or events are lost.

### Django

- Add `posthog.integrations.django.PosthogContextMiddleware` to `MIDDLEWARE` — it handles tracing headers and exceptions.
- Initialize in `AppConfig.ready()` from env vars.
- Use `new_context()` + `identify_context(user_id)` + `capture()`. Create a fresh context in login/logout views.
- Don't write custom middleware or `distinct_id` helpers — the SDK handles it.

### Flask

- Initialize PostHog globally in `create_app()` before blueprint registration.
- Manually call `posthog.capture_exception(e)` from error handlers.

### FastAPI

- Initialize in the lifespan startup, `posthog.flush()` in shutdown.
- Use Pydantic Settings with `@lru_cache` on `get_settings()`.
- Use FastAPI `Depends` for accessing `current_user` and settings.

### Ruby & Rails

- Gem is `posthog-ruby`, required as `require 'posthog'` (not `'posthog-ruby'`).
- In Rails, use the `posthog-rails` gem with `PostHog.init` in an initializer and `PostHog.capture` / `PostHog.identify` class methods everywhere else — never instantiate `PostHog::Client` directly.
- Turn on `auto_capture_exceptions`, `report_rescued_exceptions`, and `auto_instrument_active_job`.
- `capture_exception` takes **positional** args: `(exception, distinct_id, additional_properties)`.

### PHP & Laravel

- Package is `posthog/posthog-php`. SDK uses static methods (`PostHog::capture`, `PostHog::identify`) after a single `PostHog::init()`.
- Methods take associative arrays with `'distinctId'`, `'event'`, `'properties'` — not positional args.
- In Laravel, wrap in a `PostHogService` under `app/Services/` and configure via `config/posthog.php` using `env()`. Don't scatter `PostHog::capture` across controllers or use Laravel events/observers for analytics.

### Swift (iOS/macOS)

- Read `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from the Xcode scheme env, via a `PostHogEnv` enum that `fatalError`s if missing.
- Check the latest `posthog-ios` release before setting `minimumVersion` — don't hardcode a stale version.
- If the app uses macOS App Sandbox, set `ENABLE_OUTGOING_NETWORK_CONNECTIONS = YES` instead of disabling the sandbox.

### Android

- Call `PostHogAndroid.setup()` exactly once in the Application class's `onCreate()`.
- Give every activity an `android:label` so screen views track accurately.
- Adapt dependency config to the project's `build.gradle(.kts)` flavor and Gradle version.
