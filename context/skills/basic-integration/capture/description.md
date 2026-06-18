# Plan and capture events

Decide which custom events are worth capturing, then instrument them — in one
pass, reading each file once.

## Choose and record

From the project's files, select between 10 and 15 that might have business value
for event tracking — especially conversion and churn events. Read them. Track
actions, not pageviews (autocapture covers those). Server-side events are required
if there is instrumentable server-side code (API routes, server actions):
payment/checkout completion, webhook handlers, and auth endpoints.

First scan for capture calls the project already makes, and note how their event
names are formatted. Event names, property names, and feature flag keys are an
analytics contract: reuse the existing names and follow the patterns already in
the project rather than inventing parallel ones, and don't duplicate events that
already exist.

Write the chosen events to `.posthog-wizard-cache/.posthog-events.json` — a JSON
array of `{ event, description, file }`, one entry per event. That cache directory
is the wizard's, already created for the run; write the plan there, not at the
project root. Write it before you start editing: it drives the event-plan view,
and it is the source the report reads later.

## Instrument

For each event call the SDK's capture method on the real user action — the click
or submit handler, the server action — not on render or page load. Use clear
`lower_snake_case` names and useful properties. Edit each file while it is already
open.

Server-side, use the authenticated user's id as the distinct id. For a genuinely
unauthenticated action, emit a personless event — never fabricate a placeholder
id like `'anonymous'`, which collapses every anonymous user into one person and
corrupts the data.

Leave `.posthog-wizard-cache/.posthog-events.json` in place for the report.

## Reference

{references}
