---
next_step: 3-ai-approval.md
---

# Step 2 — Read context

Build a picture of what this product uses so every later decision (which sources to enable, which scouts to keep) is grounded in evidence, not guesses. **Read-only step** — no writes anywhere.

## Status

Emit:

```
[STATUS] Reading project context
```

## Tools

Load via `ToolSearch select:Read,Glob,Grep,mcp__posthog-wizard__signals-scout-project-profile-get`.

## Do

1. **Read `./posthog-setup-report.md`.** It is ground truth for what the base integration instrumented: events, error tracking, session replay, feature flags. Do not re-derive what it already states.

2. **Call `signals-scout-project-profile-get`.** It returns products in use, connected integrations, warehouse sources, and the signal source configs split enabled/disabled — one call instead of four. **Tolerate failure**: it can 404 or error on a team without a profile yet. If it fails, fall back to the step-1 source list and the report; do not retry more than once and do not abort.

3. **Light scan for what the report won't cover.** Targeted lookups only — package manifests, config files, a grep or two. You are answering these questions:
   - **Revenue**: is there a payment SDK (Stripe, Paddle, LemonSqueezy, RevenueCat…) or revenue events?
   - **Surveys**: does the code or profile show PostHog surveys in use?
   - **AI/LLM**: are there `$ai_*` events, an LLM SDK, or LLM analytics in the profile?
   - **Logs**: is the PostHog logs product in use (per the profile)?
   - **CSP**: is a Content-Security-Policy with PostHog CSP reporting configured?
   - **Support**: does the team use PostHog support/conversations (per the profile)?
   - **Issue trackers**: any hints of Linear, Zendesk, or pganalyze (you will still ask in step 6 — hints only shape the question, they never authorize enabling).

   Do NOT crawl the whole source tree. If a question can't be answered cheaply, record "unknown" and move on — unknowns default to asking the user (sources) or leaving scouts on (step 7).

4. **Write down your working checklist** (in your own notes, not a file): candidate native sources, candidate connected tools, candidate scout disables, GitHub status if the profile revealed it. Steps 5–7 consume this.
