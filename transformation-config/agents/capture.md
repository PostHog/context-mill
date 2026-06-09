---
type: capture
label: Instrument the planned events
model: claude-sonnet-4-6
skills: [capture]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [plan-capture]
---

## Goal

Instrument the events from the plan you were handed. Add a PostHog capture call at
each one, on the real user action.

## How you know you succeeded

Each planned event has a capture call that fires on the user action, not on page
load or render. If a planned event no longer fits the code, skip it and note why.
