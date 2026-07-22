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

{{> mcp-tool-calling}}

Load the local tools via `ToolSearch select:Read,Glob,Grep`. Reach the PostHog tools through the `exec` tool — run `info <tool>` before the first `call` for `scout-project-profile-get`, `query-session-recordings-list`, `surveys-get-all`, and `query-error-tracking-issues-list`.

## Do

1. **Read `./posthog-setup-report.md` if it's there.** It's written only by a recent base-wizard integration run, so it's often absent — a project set up a while ago, manually, or via the snippet won't have one, a run whose report wasn't committed won't either, and a project that never ran the wizard never does. Treat its absence as **no signal** (skip to the profile and probes below), never as "nothing instrumented". When present, it is ground truth for what the base integration instrumented **in this repo**: events, error tracking, feature flags — do not re-derive what it already states. Either way it is NOT authority over project-level facts — session replay in particular may be instrumented in another repo or via the snippet, so the report can rule replay in but never out (step 4 probes the server for that).

2. **Call `scout-project-profile-get`.** It returns products in use, connected integrations, warehouse sources, and the signal source configs split enabled/disabled — one call instead of four. It also carries **relative usage magnitude**: `top_events` (per-event count + distinct users), `recent_activity` (edits per scope), and per-entity active counts (feature flags, experiments, surveys, dashboards). Capture a rough sense of **which products this project uses most** — step 6 enables a scout only for the one or two most-used products, so a usage ranking matters, not just a binary in/out. **Tolerate failure**: it can 404 or error on a team without a profile yet. If it fails, fall back to the report and the run prompt's project-state block, and let step 4 list the current sources when it writes; do not retry more than once and do not abort. **Note "profile unavailable" in your checklist** — a profile 404 is expected on a first-run team, so any later decision that relies only on the profile must record "unknown", not a confident negative.

3. **Server-side product usage.** The run prompt's "Project state" block is authoritative for the opt-ins it lists (session replay recording, exception autocapture, surveys): **opt-in ON = product enabled**, even if no data has arrived yet. Where the block says OFF/unknown and the repo gave no signal, spend ONE cheap probe each for usage evidence (tolerate 403/404 → record "unknown"):
   - `query-session-recordings-list` — any recording → replay in use
   - `surveys-get-all` — any survey → surveys in use
   - `query-error-tracking-issues-list` — any issue → error tracking in use, even when this repo doesn't instrument it

4. **Light scan for what the report, profile, and server state won't cover.** Targeted lookups only — package manifests, config files, a grep or two. You are answering these questions:
   - **Revenue**: is there a payment SDK (Stripe, Paddle, LemonSqueezy, RevenueCat…) or revenue events?
   - **Surveys**: does the code or profile show PostHog surveys in use?
   - **AI/LLM**: are there `$ai_*` events, an LLM SDK, or LLM analytics in the profile?
   - **Logs**: is the PostHog logs product in use (per the profile)?
   - **CSP**: is a Content-Security-Policy with PostHog CSP reporting configured?
   - **Support**: does the team use PostHog support/conversations (per the profile)?
   - **Connected tools**: any hints of an issue tracker (Linear, Jira, GitLab, Gitea, Shortcut), error tracker (Sentry, Rollbar, Bugsnag, Honeybadger, Raygun), support desk (Zendesk, Freshdesk, Front, Gorgias, Kustomer, Dixa, Plain), database performance (pganalyze), security scanner (Snyk, SonarQube, Semgrep, Rapid7), or product-feedback / review tool (Featurebase, Frill, Aha, UserVoice, Productboard, Canny, AskNicely, Retently, Appfigures, AppFollow, Judge.me) — you will still ask in step 5; hints only shape the question, they never authorize enabling.

   Do NOT crawl the whole source tree. If a question can't be answered cheaply, record "unknown" and move on — unknowns default to asking the user about sources; for scouts, an unconfirmed surface won't rank among the most-used products, so step 6 won't enable its scout.

5. **Write down your working checklist** (in your own notes, not a file): candidate native sources, candidate connected tools, which products this project uses most (drives step 6's pick: `general` + the 1–2 most-used specialists), GitHub status if the profile revealed it. Steps 4–6 consume this.
