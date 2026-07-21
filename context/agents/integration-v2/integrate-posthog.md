---
type: integrate-posthog
flow: integration-v2
seed: true
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: []
allowedTools: [Read, Glob, Grep]
disallowedTools: [Write, Edit, Bash, complete_task]
dependsOn: []
---

## Goal

Plan a PostHog integration and seed the task queue. First decide which of two shapes
this project needs.

**Is the integration shape already settled by the framework?** It is when the reference
example is close to the answer for this project: the framework prescribes where the SDK
initializes, the app has a single deployable surface rather than a separate frontend and
backend, its authentication is the framework's own or it has none, and it has not
invented configuration of its own — no content-security policy it builds itself, no
asset pipeline it serves by hand. A content site, a CMS theme, a starter, a stock
single-framework app: the work is to follow a known shape, not to find one.

When all of that holds, seed the short graph:

- `integrate` — the whole integration in one pass.
- `review`, after `integrate`, parallel to `dashboard`.
- `dashboard`, after `integrate`.
- `report`, after `dashboard` and `review`.

Otherwise — a split frontend and backend, authentication the project wrote itself,
identity that crosses layers, a content-security policy or asset pipeline of its own, or
a framework you cannot match to an example — seed the full graph below. Prefer the full
graph whenever you are unsure: it is slower, while the short graph on a project that
needed the long one leaves the integration half-made.

The full graph:

- `install` and `init`, independent of each other.
- `identify` and `error-tracking`, each after `install` and `init` and independent
  of one another, so they run in parallel. `error-tracking` makes the errors the app
  does not catch reach PostHog, by whatever means the SDK offers for that — it needs
  the SDK installed and initialized, not the events.
- `capture`, after `identify` — it decides the events and instruments them, and it
  reads how identity is already established before it instruments anything.
- `build`, after `install`, `init`, `identify`, `capture`, and `error-tracking` —
  it installs the dependencies and verifies the project builds, lints, and passes
  its tests.
- `review`, after `build`, parallel to `dashboard` — a fresh set of
  eyes over every change the run made, fixing what fails review.
- `dashboard`, after `build` — only once the integration is confirmed building,
  linting, and testing cleanly.
- `report`, after `dashboard` **and** `review` — it writes the setup report last, so
  it describes the integration as reviewed rather than as first written.

## How you know you succeeded

Every task in the graph is queued with that dependency shape, the report last,
and the first task runnable. Keep labels short — the action in a few words.
