---
type: setup-metrics
flow: metrics
seed: true
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: []
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, complete_task]
dependsOn: []
---

## Goal

Plan an application-metrics setup and seed the task queue with this graph:

- `verify-sdk`, with no dependencies — it settles the SDK question (installed,
  new enough, initialized for metrics) before any instrumentation.
- `instrument-metrics`, after `verify-sdk`.
- `report`, after `instrument-metrics`. It writes the handoff last, so it
  describes what actually shipped.

Metrics ride the project's existing PostHog SDK (`posthog.metrics`), so the
graph is the same whether or not the repo has PostHog today — `verify-sdk`
absorbs the difference. Never plan an identify, capture, or dashboard task:
this run sets up application metrics, not the full integration.

## How you know you succeeded

All three tasks are queued in that dependency chain, the report last, and
`verify-sdk` runnable. Keep labels short — the action in a few words.
