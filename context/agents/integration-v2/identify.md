---
type: identify
flow: integration-v2
label: Wire user identification
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-identify, posthog-best-practices]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Wire user identification: call PostHog identify wherever the app establishes who
the user is, typically at login and signup.

## How you know you succeeded

An identify call fires at the point the user becomes known, with a stable
distinct id. If the app has no auth or user concept, say so and stop.
