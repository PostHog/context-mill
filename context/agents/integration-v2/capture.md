---
type: capture
flow: integration-v2
label: Capture events
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-capture, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init, identify]
---

## Goal

Decide which events are worth capturing in this app, then instrument them in the
same pass — read each file once, choose the events, and add the capture calls
while the file is already open.

Every capture has to be attributed, and how you get that depends on where it runs:

1. On a frontend the library attributes events on its own, as long as the user has
   been identified. So never put PII in an event — when new information about the
   user surfaces, tag the user the way the identify docs describe, not the event.
2. On a backend a capture is attributed only if it runs under an identified
   context, which you may have to trace up the call tree to establish. Where it
   does not, tag the call itself with the distinct id and the session id.

The identify step's handoff tells you which of these this app does; read it before
you instrument anything.

## How you know you succeeded

The meaningful user actions across the app have capture calls that fire on the
real action, not on page load, each one attributable to the user who took it, and
`.posthog-wizard-cache/.posthog-events.json` lists the events you instrumented.
