---
type: integrate-posthog
flow: posthog-integration
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

Plan a PostHog integration and seed the task queue with this graph:

- `install` and `init`, independent of each other.
- `identify`, `capture`, and `error-tracking`, each after `install` and `init`
  and independent of one another, so they run in parallel. `capture` decides the
  events and instruments them; `error-tracking` wires the single global error
  boundary — it needs the SDK installed and initialized, not the events.
- `build`, after `install`, `init`, `identify`, `capture`, and `error-tracking` —
  it installs the dependencies and verifies the project builds, lints, and passes
  its tests.
- `dashboard`, after `build` — only once the integration is confirmed building,
  linting, and testing cleanly.
- `report`, after `dashboard` — it writes the setup report last.

## How you know you succeeded

Every task in the graph is queued with that dependency shape, the report last,
and the first task runnable. Keep labels short — the action in a few words.
