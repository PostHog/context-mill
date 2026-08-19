---
type: scanner-user-frustration
flow: replay-vision
label: User frustration scanner
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [replay-vision-scanners-core, replay-vision-scanner-user-frustration]
allowedTools: [Read, Glob, Grep, posthog_exec]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [enable-replay]
---

## Goal

Create the **User frustration** monitor: the user getting stuck. It is gated
on `$rageclick` — cheap and high-precision, because here the gating event *is*
the friction. The skeleton, the locked fields, and the create/collision
mechanics are in your skills — you fill exactly one blank from the repo:

- **`{{PRODUCT_CONTEXT}}`** — one plain factual sentence.

**Leave the `$rageclick` gate as the only filter.** Adding a URL scope is the
change most likely to collide with the broken-experiences scanner, whose
query owns the *where*; this one owns the *what they did*. The two must never
match the same sessions.

If the enable-replay handoff says this product has no web surface and no
recorded web sessions at all, skip creation and say why — that is a correct
outcome.

## How you know you succeeded

The scanner exists in PostHog gated on `$rageclick` alone, or your handoff
says exactly why it was skipped or deferred.
