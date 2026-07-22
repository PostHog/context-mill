# Plan and capture events

Decide which custom events are worth capturing, then instrument them — in one
pass, reading each file once.

## Choose and record

From the project's files, find the actions that have business value for event
tracking — especially conversion and churn events. Read them. Track actions, not
pageviews (autocapture covers those). Server-side events matter most where there
is instrumentable server-side code (API routes, server actions): payment/checkout
completion, webhook handlers, and auth endpoints.

Around ten to fifteen is a rough guide, not a quota. Fewer is right when a small
project has only a few actions that matter — instrument those and stop; never
invent an event to reach a number, since an event nobody performs is noise in
every insight built on it. More than fifteen genuinely valuable events (auth,
payment, and the like) is also fine, but do not put them all in this run — a
first integration PR that touches everything is hard to review. Instrument the
core set now, and record the rest as suggestions for the setup report.

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
