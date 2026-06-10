---
type: integrate-posthog
flow: posthog-integration
seed: true
model: claude-sonnet-4-6
skills: []
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, complete_task]
dependsOn: []
---

## Goal

Plan a PostHog integration for this project and seed the task queue. Take a brief
glance at the repo to confirm its shape — a quick look, not a deep analysis —
then seed this graph:

- `install` and `init`, independent of each other.
- `identify` and `capture`, each after `install` and `init`, independent of each
  other. `capture` both decides the events and instruments them.
- `error-tracking`, after `capture` — event tracking goes in first, then the
  global error boundary.
- `build`, after `install`, `init`, `identify`, `capture`, and `error-tracking` —
  it installs the dependencies and verifies the project builds, lints, and passes
  its tests.
- `dashboard`, after `build` — only once the integration is confirmed building,
  linting, and testing cleanly.
- `report`, after `dashboard` — it writes the setup report last.

## How you know you succeeded

The tasks are queued with that dependency shape, and the first is runnable.
Keep them small and discrete so each finishes fast and shows visible progress.
