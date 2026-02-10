# PostHog logs for {display_name}

This skill helps you add PostHog log ingestion to {display_name} applications.

## Reference files

{references}

Consult the documentation for API details and framework-specific patterns.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys and OpenTelemetry endpoints. Never hardcode them.
- **Minimal changes**: Add log export alongside existing logging. Don't replace or restructure existing logging code.
- **OpenTelemetry**: PostHog logs use the OpenTelemetry protocol. Configure an OTLP exporter pointed at PostHog's ingest endpoint.
- **Structured logging**: Prefer structured log formats with key-value properties over plain text messages.

## Framework guidelines

{commandments}
