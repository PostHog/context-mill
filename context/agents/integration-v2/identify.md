---
type: identify
flow: integration-v2
label: Wire user identification
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [integration-v2-identify, posthog-best-practices]
allowedTools: [Read, Edit, Glob, Grep]
disallowedTools: [enqueue_task]
dependsOn: [install, init]
---

## Goal

Wire user identification so everything the app reports — its errors as much as its
events — carries who the user is.

Work out first what you are in: a client-only app, a fullstack or SSR app, or a
backend or API. Identification takes a different shape in each, and the shape
follows from that answer:

1. Client and frontend — identify once, and only once, when the user logs in or
   registers, and reset when they log out. That single call merges what was already
   captured against the anonymous id into the stable distinct id you give it. The
   library persists identity from there, so everything after it is attributed to the
   same user until reset — nothing needs re-identifying per page or per event.
2. Across the boundary — any frontend that sends requests to a backend, fullstack
   and SSR included, has to carry identity across it. Send the distinct id and the
   session id on every request, in the header format the docs describe. Some
   libraries already do this; read the docs and the example app before wiring it by
   hand.
3. Backend and API — a server serves many users at once, so identity belongs to the
   request, never to the process. Take it from the incoming request or the ambient
   context, as far as the app allows. Then either tag each event with the distinct
   id and session id, or, where the SDK has contexts, open one around the whole
   request and identify that context so everything the request reports inherits it.
   Middleware is often where that belongs. Read the docs and the example app.

## How you know you succeeded

Identification matches the kind of app you are in. While a user is known, what the
app reports is attributable to them with a stable distinct id — the errors it
reports, not only the events — established once at the boundary the SDK gives you
and never re-established at individual call sites. If the app has no auth or user
concept, say so and stop.
