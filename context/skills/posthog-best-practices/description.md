# PostHog best practices

Below are best practices that apply across PostHog products.

If the project is using a specific PostHog product, also consult that product's specific best-practice reference files in addition to this general guidance. Use the criteria below to determine if there are potential implementation issues that should be addressed, consult the relevant docs to suggest a solution, and point out the issue with reference docs when unsure.

If the project uses a specific PostHog product mentioned below, consult the relevant reference file for more specific guidance **after** following the general guidance below.
- If the project uses PostHog product analytics, also consult `references/product-analytics.md`.
- If the project uses Error Tracking, also consult `references/error-tracking.md`.
- If the project uses Experiments, also consult `references/experiments.md`.
- If the project uses Feature Flags, also consult `references/feature-flags.md`.
- If the project uses Session Replay, also consult `references/session-replay.md`.
- If you are running an audit skill (anything that produces a findings report), also consult `references/investigation-standards.md` for the provenance, evidence, and adversarial-review standards that apply to every audit finding.


## Reference files

{references}

## Key principles

- If the project uses identified analytics:
  - Identify users as early as possible after identity is known.
  - Keep identity handling consistent across runtimes.
  - If this applies, consult `references/identify-users.md`.
- If the project uses consent or privacy controls:
  - Implement an explicit opt-in / opt-out path and honor it consistently.
  - If this applies, consult `references/data-collection.md`.
- If the project uses frontend PostHog initialization:
  - Treat `phc_` project tokens as public.
  - Never expose `phx_` personal API keys.
- If the project uses logout or account-switching flows:
  - Clear analytics state with `reset()`.
  - If this applies, consult `references/identify-users.md`.
- If the project uses both browser and server runtimes:
  - Use the SDK that matches each runtime instead of sharing one implementation across both.
  - Keep both runtimes on one person. Set `tracing_headers` to your backend's
    hostname (hostnames only — no protocol, path, or port) and `posthog-js` adds
    `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` to matching `fetch` and
    `XMLHttpRequest` calls; the server SDK reads them. Without it, server events
    orphan from the frontend person.
  - Those headers are client-controlled analytics context, not authentication.
    For anything security-sensitive, pass the authenticated user id explicitly.
  - If this applies, consult the relevant framework or server docs below.
- If the project uses browser-side PostHog:
  - Initialize it once and do it early.
  - In production, use a reverse proxy. If `posthog-js` sends requests directly to `us.posthog.com` / `eu.posthog.com`, adblockers often block them.
  - If this applies, consult `references/proxy.md` for more reliable analytics.
- If the project uses short-lived processes:
  - Flush and shut down before exit.
  - If this applies, consult the relevant server SDK docs below.

## Framework guidelines

### React

If the project uses React:

- Keep initialization global.
- Avoid effect-driven inference for user actions.
- If this applies, consult [the React docs](https://posthog.com/docs/libraries/react).

### Next.js

If the project uses Next.js:

- For Next.js 15.3+, initialize PostHog in `instrumentation-client.ts`.
- Keep browser and server SDK usage separate, but stitch them to one person with
  `tracing_headers`.
- The docs' server examples pass `session.user.email` as the distinct id. Do not
  copy that: use the stable user id and keep the email a person property.
- If this applies, consult [the Next.js docs](https://posthog.com/docs/libraries/next-js).

### TanStack Router / Start

If the project uses TanStack Router / Start:

- Put the provider in the root route.
- For TanStack Start server routes, use `posthog-node` in `src/routes/api/` as a singleton.
- If this applies, consult [the TanStack Start docs](https://posthog.com/docs/libraries/tanstack-start).

### SvelteKit

If the project uses SvelteKit:

- Run `svelte-autofixer` before finishing `.svelte` changes.
- If this applies, consult [the Svelte docs](https://posthog.com/docs/libraries/svelte).

### Astro

If the project uses Astro:

- Use `is:inline` on embedded PostHog script tags.
- Prefix browser env vars with `PUBLIC_`.
- For SSR / hybrid APIs, use `posthog-node` in `src/pages/api/` as a singleton.
- If this applies, consult [the Astro docs](https://posthog.com/docs/libraries/astro).

### Angular

If the project uses Angular:

- Use `inject()` in a singleton root service, not constructor injection.
- Prefer standalone components over NgModules where structure is flexible.
- Put browser credentials in `src/environments/environment.ts`.
- If this applies, consult [the Angular docs](https://posthog.com/docs/libraries/angular).

### React Native & Expo

If the project uses React Native or Expo:

- Use `posthog-react-native` and ensure `react-native-svg` is installed.
- For bare React Native, load env via `react-native-config`.
- For Expo, use `expo-constants` with `app.config.js` extras.
- Place the provider correctly for `NavigationContainer` or `expo-router`.
- If this applies, consult [the React Native docs](https://posthog.com/docs/libraries/react-native).

### Node.js (posthog-node)

If the project uses Node.js (`posthog-node`):

- For long-running servers, enable exception autocapture and install the framework's error handler integration.
- Bind identity to the request, not to each capture: `withContext` carries a
  `distinctId` and properties across every event captured inside it, exceptions
  included. On Express, `setupExpressRequestContext` does it for the whole request
  from the incoming tracing headers.
- For short-lived processes, call `await posthog.shutdown()` before exit. If needed, use `await posthog.shutdown(shutdownTimeoutMs?)`.
- Use `posthog.flush()` only for per-request cleanup.
- Reverse proxy guidance does not apply to the server SDK itself.
- If this applies, consult [the PostHog Node.js reference](https://posthog.com/docs/references/posthog-node).

### Python

If the project uses Python:

- Use the `Posthog()` instance API, not the module-level config.
- Set `enable_exception_autocapture=True` when exception capture is needed.
- Identity belongs to a context, not to a call: `identify_context(...)` (or
  `set(...)` for person properties), never `identify()`. Everything captured
  inside a context inherits it, exceptions included, so bind it once per unit of
  work — a fresh context at the top of each route — and let plain `capture(...)`
  calls inherit. Wrapping an individual capture in its own context buys nothing.
- For scripts or CLIs, register `atexit.register(posthog.shutdown)` or call `posthog.shutdown()` before exit.
- If this applies, consult [the PostHog Python reference](https://posthog.com/docs/references/posthog-python).

### Django

If the project uses Django:

- Add `PosthogContextMiddleware`, placed after Django's `AuthenticationMiddleware`.
- That middleware already opens the request context and identifies it — from the
  `X-POSTHOG-DISTINCT-ID` header, falling back to the authenticated user's `pk`.
  So do not call `identify_context` yourself, and do not open a context around a
  capture: plain `capture(...)` in a view already inherits the request's identity.
- Initialize PostHog in `AppConfig.ready()` from env vars.
- Do not write custom middleware or `distinct_id` helpers first.
- For management commands or other short-lived processes, call the underlying Python client's `posthog.shutdown()` before exit.
- If this applies, consult [the Django docs](https://posthog.com/docs/libraries/django).

### Flask

If the project uses Flask:

- Initialize PostHog globally in `create_app()` before blueprint registration.
- No middleware ships for Flask, so nothing binds identity for you: open a fresh
  context at the top of each route and identify it there, preferring the
  authenticated user id and falling back to the incoming `X-POSTHOG-DISTINCT-ID`.
- Call `posthog.capture_exception(e)` from centralized error handlers.
- For CLI commands, jobs, or other short-lived processes, call the underlying Python client's `posthog.shutdown()` before exit.
- If this applies, consult [the Flask docs](https://posthog.com/docs/libraries/flask).

### FastAPI

If the project uses FastAPI:

- Initialize PostHog in lifespan startup and call `posthog.shutdown()` in lifespan shutdown.
- No middleware ships for FastAPI either — bind identity per request yourself, in
  a dependency or middleware that opens a context and identifies it, rather than
  at each capture.
- Prefer Pydantic Settings with `@lru_cache`.
- Use `Depends` for current user and settings in handlers.
- If this applies, consult [the Python docs](https://posthog.com/docs/libraries/python).

### Ruby & Rails

If the project uses Ruby or Rails:

- Use the `posthog-ruby` gem and `require 'posthog'`.
- For Rails, prefer the `posthog-rails` gem and initialize once in an initializer.
- Enable built-in Rails exception or job autocapture instead of recreating it.
- Pass positional args to `capture_exception`.
- If this applies, consult [the Ruby on Rails docs](https://posthog.com/docs/libraries/ruby-on-rails) or [the Ruby docs](https://posthog.com/docs/libraries/ruby).

### PHP & Laravel

If the project uses PHP or Laravel:

- Use `posthog/posthog-php` and initialize once before calling static SDK methods.
- Pass associative arrays, not positional args.
- For Laravel, wrap PostHog in a service and configure it via `config/posthog.php`.
- Bind identity per request rather than per capture: `PostHog::contextFromHeaders`
  reads the incoming tracing headers and `PostHog::withContext` wraps the request
  in that context. Prefer the authenticated id (`auth()->id()`) for anything
  security-sensitive.
- If this applies, consult [the Laravel docs](https://posthog.com/docs/libraries/laravel).

### Swift (iOS/macOS)

If the project uses Swift:

- Read `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from scheme env and fail fast if missing.
- Verify any minimum `posthog-ios` version against the latest release.
- If the app uses macOS App Sandbox, enable outgoing network connections instead of disabling the sandbox.
- If this applies, consult [the iOS docs](https://posthog.com/docs/libraries/ios).

### Android

If the project uses Android:

- Call `PostHogAndroid.setup()` exactly once in the Application class's `onCreate()`.
- Give each activity an `android:label` if screen views matter.
- Adapt dependency config to the actual `build.gradle(.kts)` flavor and Gradle version in use.
- If this applies, consult [the Android docs](https://posthog.com/docs/libraries/android).
