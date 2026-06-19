---
next_step: 3-github.md
---

# Step 2 — Read context

Build a picture of what this product uses so every later decision (which sources to enable, which scouts to keep) is grounded in evidence, not guesses. **Read-only step** — no writes anywhere.

## Status

Emit:

```
[STATUS] Reading project context
```

## Tools

Load via `ToolSearch select:Read,Glob,Grep,mcp__posthog-wizard__signals-scout-project-profile-get,mcp__posthog-wizard__query-session-recordings-list,mcp__posthog-wizard__survey-list,mcp__posthog-wizard__error-issue-list`.

## Do

1. **Read `./posthog-setup-report.md`.** It is ground truth for what the base integration instrumented **in this repo**: events, error tracking, feature flags. Do not re-derive what it already states. It is NOT authority over project-level facts — session replay in particular may be instrumented in another repo or via the snippet, so the report can rule replay in but never out (step 4 probes the server for that).

2. **Call `signals-scout-project-profile-get`.** It returns products in use, connected integrations, warehouse sources, and the signal source configs split enabled/disabled — one call instead of four. **Tolerate failure**: it can 404 or error on a team without a profile yet. If it fails, fall back to the step-1 source list and the report; do not retry more than once and do not abort.

3. **Server-side product usage.** The run prompt's "Project state" block is authoritative for the opt-ins it lists (session replay recording, exception autocapture, surveys): **opt-in ON = product enabled**, even if no data has arrived yet. Where the block says OFF/unknown and the repo gave no signal, spend ONE cheap probe each for usage evidence (tolerate 403/404 → record "unknown"):
   - `query-session-recordings-list` — any recording → replay in use
   - `survey-list` — any survey → surveys in use
   - `error-issue-list` — any issue → error tracking in use, even when this repo doesn't instrument it

4. **Light scan for what the report, profile, and server state won't cover.** Targeted lookups only — package manifests, config files, a grep or two. You are answering these questions:
   - **Revenue**: is there a payment SDK (Stripe, Paddle, LemonSqueezy, RevenueCat…) or revenue events?
   - **Surveys**: does the code or profile show PostHog surveys in use?
   - **AI/LLM**: are there `$ai_*` events, an LLM SDK, or LLM analytics in the profile?
   - **Logs**: is the PostHog logs product in use (per the profile)?
   - **CSP**: is a Content-Security-Policy with PostHog CSP reporting configured?
   - **Support**: does the team use PostHog support/conversations (per the profile)?
   - **Issue trackers**: any hints of Linear, Zendesk, or pganalyze (you will still ask in step 5 — hints only shape the question, they never authorize enabling).

   Do NOT crawl the whole source tree. If a question can't be answered cheaply, record "unknown" and move on — unknowns default to asking the user (sources) or leaving scouts on (step 6).

5. **Write down your working checklist** (in your own notes, not a file): candidate native sources, candidate connected tools, candidate scout disables, GitHub status if the profile revealed it. Steps 4–6 consume this.
