# PostHog metrics for {display_name}

This skill helps you add PostHog metric capture (counters, gauges, and histograms) to {display_name} applications.

## Reference files

{references}

Consult the documentation for API details and platform-specific patterns.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys and OpenTelemetry endpoints. Never hardcode them.
- **Minimal changes**: If the codebase already records metrics (Prometheus, StatsD, Datadog, OpenTelemetry), add the PostHog call alongside the existing one, reusing the same metric name and attributes. Don't replace or restructure existing instrumentation.
- **Metric types**: Counters for things that only go up, gauges for values that go up and down, histograms for distributions like durations. Pick the type that matches what's measured.
- **Low cardinality**: Attributes like `route`, `status`, or `plan` are good; user IDs, session IDs, request IDs, and timestamps are not. Every unique attribute combination creates a new series.
