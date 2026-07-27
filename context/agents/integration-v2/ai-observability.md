---
type: ai-observability
flow: integration-v2
label: Instrument LLM calls
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [llm-analytics-setup, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [Bash, enqueue_task]
dependsOn: [install, init]
---

## Goal

Route this app's LLM calls through PostHog so each generation reports its model,
cost, latency, and token counts. The provider or framework in use decides the shape:
a wrapped client, a callback handler, a decorator. Follow the reference for the
provider this project actually imports, and reach the PostHog client the way the init
step already established — never construct a second one.

Instrument at the client, not at the call sites: one wrapped client that every call
site already reaches beats editing each call. If a call site must change, keep the
change to the smallest edit that routes it through the wrapped client.

Where the app has a user identity available at the call, pass it as the distinct id
so generations attribute to a person. Where it does not, leave it out rather than
inventing one — an anonymous generation is still useful, a wrong identity is not.
Never send prompt or completion content the app treats as sensitive.

## How you know you succeeded

Every LLM entry point in the app goes through the instrumented client, the project
still builds the way it did before you started, and no second PostHog client exists.
Your handoff names the files you changed, the provider or framework each one uses,
whether a distinct id was available, and what a reviewer should read to confirm the
call path. If the project imports an LLM SDK you found no reference for, say so and
leave it uninstrumented rather than guessing at an API.
