# PostHog Error Tracking best practices

Use this reference when the project is capturing, filtering, grouping, or cost-controlling PostHog error tracking data.

Do not read this page unless a rule below is violated and you need further explicit guidance. When making suggestions, reference the [Error tracking](https://posthog.com/docs/error-tracking), [Capture exceptions for error tracking](https://posthog.com/docs/error-tracking/capture), [Upload source maps for web](https://posthog.com/docs/error-tracking/upload-source-maps/web), and [Error Tracking pricing](https://posthog.com/docs/error-tracking/pricing) docs pages as sources.

## Rules

- `error`: Never send exceptions with `posthog.capture('$exception', ...)`. Use the SDK's exception capture API such as `posthog.captureException(...)` so PostHog receives valid exception metadata.
- `error`: If the app serves minified or compiled browser bundles in production, upload source maps and deploy the injected assets in your deployment pipelines. Otherwise stack traces stay minified or fail to match uploaded maps. Consult [Upload source maps](https://posthog.com/docs/error-tracking/upload-source-maps) for the exact pattern for your project.
- `warning`: Configure browser exception autocapture deliberately. Review the `capture_exceptions` config instead of assuming the defaults are appropriate for this app. In particular, check whether `capture_unhandled_errors`, `capture_unhandled_rejections`, or `capture_console_errors` are enabled, and disable any path the project is not prepared to monitor, triage, and pay to ingest. Consult [Capture exceptions for error tracking](https://posthog.com/docs/error-tracking/capture) for the exact config options.
- `warning`: Keep `capture_console_errors: false` unless console errors are intentionally part of the monitoring scope.
- `suggestion`: Suppress known noisy client-side exceptions with `before_send` or project suppression rules instead of ingesting them and paying for them.
- `warning`: Add stable custom properties during exception capture only when they help grouping, routing, or debugging.
- `warning`: Override `$exception_fingerprint` only when you intentionally want custom grouping behavior.
- `suggestion`: Keep the JavaScript SDK's burst protection defaults unless the project has a clear reason to tune the rate limiter.
