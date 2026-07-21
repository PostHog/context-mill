---
type: integrate
flow: integration-v2
label: Integrate PostHog
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-install, integration-v2-init, integration-v2-identify, integration-v2-error-tracking-step, integration-v2-capture, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Integrate PostHog into this project in one pass: declare the SDK, initialize it,
identify users, make uncaught errors reach PostHog, and instrument the events worth
capturing. You are used when the project's integration shape is already settled by its
framework — the reference example is close to the answer, and there is no split
frontend and backend, no hand-rolled auth, and no configuration the app invented for
itself. Follow the example's shape adapted to this codebase rather than surveying the
project for a design.

Work in this order, because each step constrains the next:

1. Declare the SDK in the project's manifest, at a version range that resolves to a
   current release.
2. Initialize it once at the entry point the framework prescribes, reading keys from
   the environment, and document those variable names where the project documents its
   configuration.
3. Establish identity at the boundary the SDK gives you — the app's own stable
   identifier for the user, never an email or name unless the app has nothing else.
4. Make the errors the app does not catch reach PostHog by whatever means the SDK
   offers for this framework.
5. Instrument the actions a product team would ask about — the handful of things users
   do that a funnel or a trend would be built from. Prefer the actions that already
   have a handler over inventing new seams to capture from.

Record what you instrumented in `.posthog-wizard-cache/.posthog-events.json`, relative
to the project root, in the shape the capture skill describes. Later steps build the
dashboard and the report from that file alone and never re-read your code, so an event
missing from it may as well not exist.

## How you know you succeeded

The SDK is declared, initialized once at the framework's entry point, and reads its
configuration from the environment without breaking the app when that configuration is
absent. A known user's activity is attributable to them by a stable id. Uncaught errors
reach PostHog. The events you instrumented are real product actions, they carry the
properties needed to segment them, and every one of them is written to the event plan.
Your handoff names each file you changed, what you did there, and which insight or
funnel the change feeds — a reviewer reads only your handoff and the diff, so anything
you leave out is invisible to them.
