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

Plan a PostHog integration and seed the task queue with this graph:

- `install` and `init`, independent of each other. `init` also configures the products
  that are init-time options rather than steps of their own — autocapture, pageviews,
  session replay — and owns two tasks you do not queue: the repo groom
  (`product-signals`) and the project-side switch-on (`enable-features`) that reads it.
  Leave both to `init`; queueing either here would run it before the groom exists.
- `identify` and `error-tracking`, each after `install` and `init` and independent
  of one another, so they run in parallel. `error-tracking` makes the errors the app
  does not catch reach PostHog, by whatever means the SDK offers for that — it needs
  the SDK installed and initialized, not the events.
- `ai-observability`, after `install` and `init`, **only if this project actually
  calls an LLM**. Read the manifests before you decide: an LLM SDK or framework in the
  dependencies (`openai`, `@anthropic-ai/sdk`, `ai`, `@ai-sdk/*`, `langchain`,
  `cohere`, `mistralai`, `google-genai`, or their Python equivalents in
  `requirements.txt` / `pyproject.toml`). Found one, queue it; found none, leave it
  out — omitting it is the right plan for an app with no LLM calls, not a gap.
- `review`, after `install`, `init`, `identify`, `error-tracking`, and
  `ai-observability` if you queued it — it installs the dependencies, verifies the
  project builds/typechecks/lints, and reviews every change the run made, fixing what
  fails. There is no separate build step: verifying and reviewing are one pass over
  the same changeset. It does not wait on the project-side switch-on, which touches no
  code.
- `report`, after `review` — it writes the handoff last, so it describes an integration
  that has already been reviewed. It reads every step's handoff out of the queue log,
  including the tasks `init` queued, so it needs no edge to them.

This run does not instrument events and does not build insights or dashboards. That is
deliberate: it leaves the user's own agent the tools and the suggestions to do that,
and it is why the run is short. Do not queue work for it.

## How you know you succeeded

Every task in the graph is queued with that dependency shape, the report last, and the
first task runnable. `ai-observability` is present exactly when the manifests justify
it. Keep labels short — the action in a few words.
