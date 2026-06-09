---
type: capture
label: Capture events
model: claude-sonnet-4-6
skills: [capture]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Decide which events are worth capturing in this app, then instrument them in the
same pass — read each file once, choose the events, and add the capture calls
while the file is already open.

## How you know you succeeded

The meaningful user actions across the app have capture calls that fire on the
real action, not on page load, and `.posthog-events.json` lists the events you
instrumented.
