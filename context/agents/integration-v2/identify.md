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
events — carries who the user is. Where the SDK remembers an identity once it is
established, establish it at the moment the app learns who the user is. Where
identity is instead scoped to a unit of work, bind it once for that whole scope
rather than at the individual call sites inside it.

## How you know you succeeded

While a user is known, what the app reports is attributable to them with a stable
distinct id — the errors it reports, not only the events — and identity is
established in as few places as the SDK allows. If the app has no auth or user
concept, say so and stop.
