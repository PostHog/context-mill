# PostHog metrics for {display_name}

This skill helps you add PostHog application metrics (`posthog.metrics`) to {display_name} applications. Metrics are pre-aggregated, service-level telemetry — counters, gauges, and histograms — distinct from product analytics events.

## Reference files

{references}

Consult the documentation for API details and platform-specific patterns.

## Where to instrument

Metrics measure **operational work**, not user actions. Instrument the places where the service does work, in this priority order:

1. **Request/response layer**: a `count` per handled request and a `histogram` of request duration, added in middleware or an equivalent single choke point — never per-route by hand.
2. **Background work**: job/queue/task handlers — jobs processed (`count`), job duration (`histogram`), queue depth (`gauge`).
3. **External dependencies**: outbound API calls, database queries, cache lookups — call counts with an outcome attribute, latency histograms.
4. **Business throughput counters**: domain operations completing (orders placed, invoices processed, emails sent) — add the `count` at the single place the operation is committed, next to any existing `capture()` call for the same action.

If the user asks for specific metrics, instrument those instead. Prefer a few well-placed metrics at choke points (middleware, base handlers, shared clients) over scattering calls through every route or function.

## Key principles

- **Environment variables**: Always use environment variables for the PostHog API key and host. Never hardcode them.
- **Minimal changes**: Add metrics alongside existing code. Don't replace existing telemetry (StatsD, Prometheus, OTel) — and if the project already has one of these, ask before adding a parallel system.
- **Configure the client**: Set `service_name` (and environment/version if known) in the metrics config at client init, so series are attributable to this service.
- **Metric types**: `count` for monotonic totals (value defaults to 1, negatives are dropped), `gauge` for point-in-time levels (last value wins), `histogram` for distributions (durations, sizes — pass `unit`, e.g. `"ms"`).
- **Naming**: lowercase dot-namespaced names like `http.requests`, `job.duration`, `orders.placed`. Treat metric names as a contract — define each name in one place, don't scatter variants.
- **Low cardinality only**: attributes must be bounded sets (route pattern, plan, region, outcome). Never user IDs, emails, session IDs, raw URLs, or other unbounded/PII values — each distinct attribute combination is a new series, and there is a per-flush series cap.
- **No per-user context**: metrics carry no `distinct_id`. If the question is "which user did X", that's an event (`capture()`), not a metric.
- **Flushing**: metrics flush on an interval and on client shutdown. For short-lived processes (scripts, serverless), call `flush()`/`shutdown()` before exit or nothing is sent.

## Framework guidelines

{commandments}
