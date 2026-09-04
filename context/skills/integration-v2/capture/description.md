# Plan and capture events

Decide which custom events are worth capturing, then instrument them — in one
pass, reading each file once.

## Choose and record

From the project's files, find the actions that have business value for event
tracking — especially conversion and churn events. Read them. Track actions, not
pageviews, wherever this SDK autocaptures them. Where it does not — the docs and
reference example for this framework will say so explicitly — wire the screen-view mechanism they
show, since without it this integration records no navigation at all. Server-side
events matter most where there is instrumentable server-side code (API routes,
server actions): payment/checkout completion, webhook handlers, and auth
endpoints.

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
or submit handler, the server action — not on render or page load. Where that
action waits on a server, capture the outcome rather than the attempt: the call
belongs in the branch that runs after the awaited response confirms success, so a
submission the server rejects never counts as one that worked. Capture the attempt
as well where the drop-off between the two is worth measuring, under its own
name — one name must never mean both. Use clear `lower_snake_case` names and
useful properties. Edit each file while it is already open.

Server-side, use the authenticated user's id as the distinct id. For a genuinely
unauthenticated action, emit a personless event — never fabricate a placeholder
id like `'anonymous'`, which collapses every anonymous user into one person and
corrupts the data.

Backend SDKs process a person profile on every capture that carries a distinct id,
and the runtime metadata they attach — `$os`, `$lib`, and the rest — overwrites
whatever the browser set on that same person, so an event captured from a Linux
host rewrites a macOS user's profile. Pass `$process_person_profile: false` on
server-side business events that are not meant to update person properties, which
is most of them. Leave it off only where the capture deliberately updates the
person, paired with an `identify()` or `$set` in the same flow.

Leave `.posthog-wizard-cache/.posthog-events.json` in place for the report.

## Reference

{references}
