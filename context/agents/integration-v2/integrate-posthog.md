---
type: integrate-posthog
flow: integration-v2
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
- `identify` and `error-tracking`, each after `install` and `init` and independent
  of one another, so they run in parallel. `error-tracking` makes the errors the app
  does not catch reach PostHog, by whatever means the SDK offers for that — it needs
  the SDK installed and initialized, not the events.
- `capture`, after `identify` — it decides the events and instruments them, and it
  reads how identity is already established before it instruments anything.
- `review`, after `install`, `init`, `identify`, `capture`, and `error-tracking` —
  it installs the dependencies, verifies the project builds/typechecks/lints, and
  reviews every change the run made, fixing what fails. There is no separate build
  step: verifying and reviewing are one pass over the same changeset.
- `dashboard`, after `capture`, parallel to `review` — it builds insights from the
  instrumented events, which `capture` has already defined; it needs no code review.
- `report`, after `dashboard` **and** `review` — it writes the setup report last, so
  it describes the integration as reviewed rather than as first written.

## How you know you succeeded

Every task in the graph is queued with that dependency shape, the report last,
and the first task runnable. Keep labels short — the action in a few words.
