---
next_step: 3-otel-setup.md
title: AI Observability Setup - Install
description: Add the OpenTelemetry SDK, PostHog span processor, and provider instrumentation to the manifest
---

Declare the packages this variant needs in the project's manifest. Do not run the package manager here — the base integration's build/verify step (or the user) installs everything in one pass.

Read the manifest first. If any of the required packages is already declared, leave the existing version alone and say so. Match the style of dependencies already in the file (versions, ordering, dev vs. runtime).

## What to add

The linked install page for this variant carries the authoritative command. The shapes below reflect the current defaults across Tier-1 providers.

### Python — the standard OTel path

Three packages:

```
posthog[otel]                                   # PostHog SDK + span processor
opentelemetry-sdk                               # OTel core
opentelemetry-instrumentation-<provider>        # provider auto-instrumentation
```

Examples:

- OpenAI → `opentelemetry-instrumentation-openai-v2`
- Anthropic → `opentelemetry-instrumentation-anthropic`
- LangChain → `opentelemetry-instrumentation-langchain`
- Google Gemini → `opentelemetry-instrumentation-google-generativeai`

The vendor SDK itself (`openai`, `anthropic`, `langchain`, …) is a prerequisite — it should already be declared. Do not add or upgrade it.

### Node — the standard OTel path

```
@posthog/ai                                     # PostHog span processor
@opentelemetry/sdk-node                         # OTel core (Node)
@opentelemetry/resources                        # resource attributes
@opentelemetry/instrumentation-<provider>       # provider auto-instrumentation
```

Provider instrumentation packages:

- OpenAI → `@opentelemetry/instrumentation-openai`
- Anthropic → `@traceloop/instrumentation-anthropic`
- LangChain → `@traceloop/instrumentation-langchain`
- Google Gemini → `@traceloop/instrumentation-google-generativeai`

### Vercel AI SDK (Node)

No provider instrumentation package — Vercel AI emits OTel spans natively when `experimental_telemetry` is enabled. Just add:

```
@posthog/ai
@opentelemetry/sdk-node
@opentelemetry/resources
```

### `manual-capture` variant

No OTel packages. Just PostHog core:

```
posthog                # Python
posthog-node           # Node
```

If PostHog core is already installed (it should be — see `1-begin.md`), this file has nothing to add. Skip to `3-otel-setup.md`, which describes the manual `capture(...)` call shape.

## Do not do

- Do not run `npm install` / `pip install` here.
- Do not edit the lockfile.
- Do not upgrade the vendor SDK.
- Do not add both an OTel-based instrumentation package *and* the older wrapper client — pick one. This skill uses the OTel path.
