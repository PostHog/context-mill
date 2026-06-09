---
type: integrate-posthog
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
- `identify`, `error-tracking`, and `plan-capture`, each after `install` and
  `init`, independent of each other.
- `capture`, after `plan-capture`.
- `build`, after `install`, `init`, `identify`, `error-tracking`, and `capture` —
  it installs the dependencies and verifies the project compiles.
- `dashboard`, after `capture`.
- `report`, after `build` and `dashboard` — it writes the setup report last.

## How you know you succeeded

The nine tasks are queued with that dependency shape, and the first is runnable.
Keep them small and discrete so each finishes fast and shows visible progress.
