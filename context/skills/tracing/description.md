# PostHog distributed tracing for {display_name}

This skill helps you send distributed traces from {display_name} applications to PostHog. A trace is a tree of spans that follows one request across services, queues, and external calls, so you can see where the time went and which step failed.

## Reference files

{references}

Consult the documentation for API details and platform-specific patterns.

## Choose the capture path

- **Node.js with `posthog-node` >= 5.52.0**: `posthog-node` creates and exports spans itself, with no OpenTelemetry dependency. Set the `traces` option on the existing client and wrap operations in `withSpan` (or `startSpan` for work that can't wrap a callback).
- **Python with `posthog` >= 7.57.0**: the `posthog` package creates and exports spans itself, with no OpenTelemetry dependency. Set the `traces` option on the existing synchronous `Posthog` client (or `posthog.traces` for the module-level API) and wrap operations in `with posthog.start_span(...)`. `AsyncPosthog` has no span API, so use OpenTelemetry there.
- **OpenTelemetry already in the project**: point its OTLP trace exporter at `/i/v1/traces` on the PostHog host, with the project token as an `Authorization: Bearer` header. Don't add `posthog-node` or `posthog` spans alongside it.
- **Everything else**: use the OpenTelemetry SDK for the language, as the platform reference describes. It is also the only route to auto-instrumentation of HTTP servers, frameworks, and database drivers.

## Where to instrument

1. **Request entry**: one server span per handled request, created in middleware or an equivalent single choke point, never per route by hand.
2. **Outbound calls**: HTTP clients, database queries, cache lookups, and queue publishes, so the trace shows which dependency was slow.
3. **Background work**: job and queue handlers, as the root span of their own trace or continuing the trace that enqueued them.

If the user asks for specific spans, instrument those instead. A few spans at choke points beat a span around every function.

## Key principles

- **Environment variables**: Always use environment variables for the PostHog project token, host, and OTLP endpoint. Never hardcode them.
- **Region**: Take the host from the project's existing PostHog configuration. If there is none, ask whether the project is on US Cloud (`https://us.i.posthog.com`) or EU Cloud (`https://eu.i.posthog.com`). Do not assume US Cloud.
- **Minimal changes**: Add spans alongside existing code. Don't replace existing tracing, and if the project already exports to another tracing backend, ask before adding PostHog as a second destination.
- **Service name**: Set a service name at setup (`traces.serviceName` in `posthog-node`, `traces["service_name"]` in Python `posthog`, `service.name` in OpenTelemetry) so spans are attributable in the Tracing UI.
- **Span names**: Low-cardinality operation names, like `GET /users/:id` rather than `GET /users/123`. Variable values belong in attributes.
- **Attributes**: Never put secrets, tokens, or passwords in attributes. In `posthog-node`, `beforeSpanSend` can scrub or drop spans before export; in Python `posthog`, `before_span_send`.
- **Context propagation**: Pass the W3C `traceparent` header on outbound requests between services, so their spans join one trace instead of starting new ones.
- **People and sessions**: A span joins a person or a Session Replay recording through `posthogDistinctId` and `sessionId` attributes. `posthog-node` sets them for spans created inside a PostHog request context (`withContext`, or the Express middleware), and Python `posthog` does the same inside `new_context()` with `identify_context()` / `set_context_session()`, or the Django contexts middleware. With OpenTelemetry, set them yourself from the `X-POSTHOG-DISTINCT-ID` and `X-POSTHOG-SESSION-ID` headers the browser SDK sends when `tracing_headers` is configured.
- **Flushing**: Spans export on an interval. In short-lived processes and serverless handlers, call `flush()` (or the OpenTelemetry provider's `forceFlush()`) before returning, and `shutdown()` only when the process is exiting.

## Framework guidelines

{commandments}
