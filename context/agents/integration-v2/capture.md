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
while the file is already open. Instrumenting the events is the job; everything
below is a rule you apply while you do it, not work of its own.

The identify step's handoff already says how this app attributes events. Read it
once, up front, and follow it:

1. Where identity is established for you — a client library that remembers it, or a
   framework middleware that binds it per request — a plain capture is already
   attributed. Write the plain call and move on. Do not add a context of your own,
   and do not go looking through the call tree to prove it.
2. Where the handoff says it is not — no middleware, or a call path that runs
   outside the request — tag that call with the distinct id and the session id.

A handoff that answers neither should not reach you. If one does, do not invent a
fallback and do not guess at the id — instrument the events plainly, and say in your
handoff that attribution is unresolved and why, so the report raises it as an issue to
follow up instead of claiming events that belong to nobody.

Never put PII in an event. When new information about the user surfaces, tag the
user the way the identify docs describe, not the event.

## How you know you succeeded

The meaningful user actions across the app have capture calls that fire on the
real action, not on page load, each one attributable to the user who took it, and
`.posthog-wizard-cache/.posthog-events.json` lists the events you instrumented.
