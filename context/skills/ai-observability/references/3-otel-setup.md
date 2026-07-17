---
next_step: 4-verify.md
title: AI Observability Setup - OpenTelemetry
description: Initialize the OTel TracerProvider with PostHog's span processor and attach the provider instrumentor
---

Initialize OpenTelemetry once, at the app's entry point, so it is running before any LLM call executes. This is the single place PostHog reads the project token and host from — everything after this is normal LLM code that gets auto-traced.

## Environment variables

Route the PostHog credentials through env vars, using the wizard's `set_env_values` tool (never hardcode). Reuse whatever names the base PostHog integration already set — typically:

- the public project token (e.g. `POSTHOG_API_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, or the framework's convention)
- the PostHog host (e.g. `POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_HOST`)

If the project has an `.env.example` file, add the names there with empty placeholder values so collaborators know what to set. Create `.env.example` if it doesn't exist. Never write real secrets to any file.

## Initialization shape

There is one initialization call per app. It runs once, at startup, before any vendor SDK call. The linked install page carries the exact code for this variant's language — copy from there.

### Python — the standard OTel path

Wire a `TracerProvider` with `PostHogSpanProcessor`, then call `.instrument()` on the provider-specific instrumentor:

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from posthog.ai.otel import PostHogSpanProcessor
from opentelemetry.instrumentation.openai_v2 import OpenAIInstrumentor   # swap per provider

provider = TracerProvider(resource=Resource(attributes={SERVICE_NAME: "my-app"}))
provider.add_span_processor(PostHogSpanProcessor(
    api_key=os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
))
trace.set_tracer_provider(provider)

OpenAIInstrumentor().instrument()
```

### Node — the standard OTel path

Use `NodeSDK` with `PostHogSpanProcessor` and the provider instrumentation. Start it before importing the vendor SDK in the app's entry point:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PostHogSpanProcessor } from '@posthog/ai/otel'
import { OpenAIInstrumentation } from '@opentelemetry/instrumentation-openai'   // swap per provider

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ 'service.name': 'my-app' }),
  spanProcessors: [new PostHogSpanProcessor({
    apiKey: process.env.POSTHOG_API_KEY!,
    host: process.env.POSTHOG_HOST!,
  })],
  instrumentations: [new OpenAIInstrumentation()],
})
sdk.start()
```

For Next.js / Nuxt / other frameworks that expose a dedicated startup hook (`instrumentation.ts`, `nuxt.config`'s server plugin, etc.), put the SDK init there. It must run once per process, not per request.

### Vercel AI SDK

No instrumentor package. Initialize `NodeSDK` with just `PostHogSpanProcessor` (no `instrumentations` array), then pass `experimental_telemetry` per call:

```typescript
const result = await generateText({
  model: openai('gpt-5-mini'),
  prompt: '...',
  experimental_telemetry: { isEnabled: true, functionId: 'my-ai-function' },
})
```

If the project has many call sites, wrap the config into a shared helper rather than repeating it inline.

### `manual-capture` variant

No OTel. Capture each generation explicitly at the call site:

```python
posthog.capture(
    distinct_id="user_123",
    event="$ai_generation",
    properties={
        "$ai_provider": "openai",
        "$ai_model": "gpt-4",
        "$ai_input": [{"role": "user", "content": prompt}],
        "$ai_output_choices": [{"role": "assistant", "content": response}],
        "$ai_input_tokens": usage.prompt_tokens,
        "$ai_output_tokens": usage.completion_tokens,
        "$ai_latency": latency_seconds,
    },
)
```

Refer to `/docs/ai-observability/manual-capture` for the full property list.

## Do not

- Do not create a second PostHog client instance. Reuse the project token / host already in the app's env — the OTel span processor is a separate exporter, not a separate PostHog install.
- Do not put SDK init inside a request handler. Once per process, at startup.
- Do not import the vendor SDK above the OTel init in the same file — the instrumentor patches the SDK when it loads, so the order matters.
