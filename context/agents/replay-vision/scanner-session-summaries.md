---
type: scanner-session-summaries
flow: replay-vision
label: Session summaries scanner
model_pi: openai/gpt-5.6-terra
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [replay-vision-scanners-core, replay-vision-scanner-session-summaries]
allowedTools: [Read, Glob, Grep, posthog_exec]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [enable-replay]
---

## Goal

Create the **Session summaries** summarizer: a rolling sample of
plain-language session summaries, so the user sees the breadth of what
scanners produce. The skeleton, the locked fields, and the create/collision
mechanics are in your skills — you fill exactly one blank from the repo:

- **`{{PRODUCT_CONTEXT}}`** — one plain factual sentence, in the product's
  own vocabulary.

It samples every recording with no query scope, kept cheap by a low sampling
rate — **never raise the sampling rate during setup**.

If the enable-replay handoff says this product has no web surface and no
recorded web sessions at all, skip creation and say why — that is a correct
outcome.

## How you know you succeeded

The scanner exists in PostHog at the skeleton's sampling rate, or your
handoff says exactly why it was skipped or deferred.
