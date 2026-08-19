---
type: scanner-broken-experiences
flow: replay-vision
label: Broken experiences scanner
model_pi: openai/gpt-5.6-terra
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [replay-vision-scanners-core, replay-vision-scanner-broken-experiences]
allowedTools: [Read, Glob, Grep, posthog_exec]
disallowedTools: [Write, Edit, Bash, enqueue_task]
dependsOn: [enable-replay]
---

## Goal

Create the **Broken experiences** monitor: the product visibly breaking, on
the flow where breaking costs the most. The skeleton, the locked fields, and
the create/collision mechanics are in your skills — you fill exactly two
blanks from the repo:

- **`query`** — this product's key completion flow plus its immediate
  predecessors. Checkout, signup, booking, publish — whatever this product's
  "done" is. Read router files and page/route directories to find the real
  paths; never guess at `/checkout` if this app calls it `/booking`.
- **`{{PRODUCT_CONTEXT}}`** — one plain factual sentence.

If there is no identifiable completion flow, don't invent one — fall back to
the handful of highest-traffic paths and record in your handoff that you
couldn't identify a completion flow. If the enable-replay handoff says this
product has no web surface, skip creation entirely and say why — that is a
correct outcome.

Your query filters on *where* the user is (URL). The frustration scanner
filters on *what they did* (`$rageclick`). The two must never match the same
sessions — and never gate this monitor on `$exception`: that blinds it to
silent breakage, the thing vision is uniquely good at.

## How you know you succeeded

The scanner exists in PostHog scoped to this product's real completion flow,
or your handoff says exactly why it was skipped or deferred.
