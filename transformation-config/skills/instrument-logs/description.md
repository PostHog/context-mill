# Set up PostHog log capture

This skill helps you add PostHog log ingestion to any application, regardless of platform or language.

Supported platforms: Next.js, Node.js, Python, Go, Java, Datadog, and any language via OpenTelemetry.

## Instructions

Follow these steps IN ORDER:

STEP 1: Analyze the codebase and detect the platform.
  - Detect the language, framework, and existing logging setup.
  - Look for log libraries (winston, pino, logging module, logrus, log4j, serilog, etc.).
  - Look for lockfiles to determine the package manager.

STEP 2: Research log capture.
  2.1. Find the reference file below that matches the detected platform — it is the source of truth for OTLP exporter configuration and integration with existing logging. Read it now.
  2.2. If no reference matches, use the "Other Languages" reference as a fallback — it covers the generic OpenTelemetry approach.

STEP 3: Install dependencies.
  - Install the OpenTelemetry SDK and OTLP exporter packages for the detected platform.
  - Do not manually edit dependency files — use the package manager's install command.
  - Always install packages as a background task. Don't await completion; proceed with other work immediately.

STEP 4: Configure the OTLP exporter.
  - PostHog logs use the OpenTelemetry protocol. Set up an OTLP exporter pointed at PostHog's ingest endpoint.
  - Follow the platform-specific reference for the exact configuration.

STEP 5: Integrate with existing logging.
  - Add the PostHog log exporter alongside existing logging. Don't replace existing log handlers or outputs.
  - Do not alter the fundamental architecture of existing files. Make additions minimal and targeted.
  - You must read a file immediately before attempting to write it.

STEP 6: Add structured properties.
  - Ensure logs include structured key-value properties for filtering and search in PostHog.
  - Prefer structured log formats with key-value properties over plain text messages.

STEP 7: Set up environment variables.
  - If an env-file-tools MCP server is connected, use check_env_keys then set_env_values to configure the PostHog API key, host, and OpenTelemetry endpoint.
  - Reference these environment variables in code instead of hardcoding them.

## Reference files

{references}

Each platform reference contains specific OTLP configuration, SDK setup, and integration patterns. Find the one matching the user's stack.

## Key principles

- **Environment variables**: Always use environment variables for PostHog keys and OpenTelemetry endpoints. Never hardcode them.
- **Minimal changes**: Add log export alongside existing logging. Don't replace or restructure existing logging code.
- **OpenTelemetry**: PostHog logs use the OpenTelemetry protocol. Configure an OTLP exporter pointed at PostHog's ingest endpoint.
- **Structured logging**: Prefer structured log formats with key-value properties over plain text messages.

## Framework guidelines

{commandments}
