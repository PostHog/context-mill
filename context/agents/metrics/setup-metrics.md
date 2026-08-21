---
type: setup-metrics
flow: metrics
seed: true
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: []
allowedTools: [Read, Glob, Grep, load_skill_menu]
disallowedTools: [Write, Edit, Bash, complete_task]
dependsOn: []
---

## Goal

Plan an application-metrics setup: pick the right metrics skill for this
project, then seed the task queue.

First, pick the skill. Call `load_skill_menu` with `category: "metrics"` — the
menu is the source of truth, one variant per platform. Match the project
against it: Python tooling points at the Python variant, a `package.json` with
server-side code at the Node variant, a browser-only `package.json` at the web
variant, Kubernetes manifests at the Kubernetes variant, anything else at the
OTLP variant. A full-stack app usually wants the server variant — metrics
measure service work, not user actions.

Then seed this graph, passing the picked variant id to each task as
`inputs: { skill: "<variant id>" }`:

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

All three tasks are queued in that dependency chain with the same skill input,
the report last, and `verify-sdk` runnable. Keep labels short — the action in
a few words.
