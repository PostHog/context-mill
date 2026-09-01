# PostHog Self-driving setup

This skill configures PostHog Signals for a project that already has PostHog installed: it switches on the signal sources (the inbox's "Responders") that match what the product actually uses, makes sure the GitHub integration is connected so Signals can research and fix issues in code, tunes the scout troop, designs custom scouts for the watchable surfaces the built-in troop doesn't cover (always proposed to the user first), and puts Replay Vision scanners on the product's key flows so on-screen breakage reaches the inbox too. Organization-level AI data processing approval — which everything downstream depends on — is enforced by the wizard itself before this skill runs.

The wizard's run prompt supplies the project URLs (integrations settings, organization AI settings, new warehouse source, Signals inbox). Use those exact URLs whenever a step sends the user to the browser.

## Workflow

The setup runs as a 10-step chain:

{workflow}

Each step file points to the next. Run them in order. **Start by reading `references/1-check-access.md`** (relative to this skill's directory — typically `.claude/skills/self-driving-setup/references/1-check-access.md`). Don't read ahead. Don't re-read a step once you've passed it. Don't re-read SKILL.md.

## Ground rules

- **Trust the setup report.** `./posthog-setup-report.md` is ground truth for what is instrumented. Scan the codebase only for what the report won't cover.
- **Every write must be idempotent.** List before you create. A duplicate `inbox-source-configs-create` returns 400 — recover by finding the existing row's `id` and calling `inbox-source-configs-partial-update` with `enabled: true`.
- **On is the only direction this run moves a source.** An enabled row is someone's deliberate choice, so it stays. Scouts are the one thing this run also tunes downward — that's step 6's job, on scout configs only.
- **Connected tools are ask-then-connect.** The user's answer in step 5 is what authorizes each issue-tracking, error-tracking, support, security-scanner, product-feedback, or search-analytics source (GitHub Issues, Linear, Jira, Google Search Console, …). Repo hints shape the question; they never stand in for the answer.
- **The write surface is this list, and it ends here.** On a source config: `enabled`. On a scout config: `enabled`. New `signals-scout-*` skills: step 6b, and only the ones the user approved there. Replay Vision scanners: step 6c's shared briefs, filling the blanks in their locked scaffolds (`scanner_type`, `emits_signals`, prompt scaffold). Everything else on these objects belongs to the products that own them — the `emit` and `run_interval_minutes` defaults, built-in scout bodies, `signals-scout-emit-signal`, and the scratchpad tools are all theirs to set, and the server's defaults are the intended posture.
- **Keep the scout troop inside one budget of about ten.** Every enabled scout is a recurring LLM spend, and scout runs are budgeted server-side — a project gets up to 100 scout runs a day by default during early access (`scout-metadata-get` reports the enforced limits). Findings per run hold steady up to roughly ten enabled scouts and fall off past that, so **about ten enabled scouts is the ceiling, not a target** and the two steps share it: step 6 enables `signals-scout-general` plus **up to five** specialists for the products this project uses most, three to five on a project with that many genuinely-used surfaces and fewer when it hasn't, drawn from the surfaces the route map below sends to scouts — and step 6b adds **up to five** custom scouts, zero being a perfectly good answer, traded against the specialists so the total stays at or under ten. Where an enforced `max_runs_per_day` is lower than ten, that is the tighter bound. Everything else stays disabled.
- **Batch your questions.** `wizard_ask` has a small per-run budget; one multi-select beats four yes/nos. Don't skip a step or drop a connector (e.g. Linear) or custom scouts setup to save calls.
- **The "too many in a row / batch your questions" error is a soft nudge, not the budget running out — retry it.** `wizard_ask` raises it once, on a call it thinks should have been batched. Your genuinely sequential asks — the per-source connector confirms in step 5 (GitHub Issues, Linear, and the credential connect links for Zendesk / pganalyze / Jira), and above all the custom-scouts proposal in step 6b — can't be batched (each depends on an earlier answer or on analysis done in between), so **re-issue the exact same call once and it goes through.** Only a `cap reached (N calls)` error means the budget is actually spent. Never record a step as a follow-up — least of all the custom scouts — just because you hit the batch nudge; that silently drops real work the user wanted.
- **Decline goes first.** Every `wizard_ask` that offers choices must include a plain-language decline option (skip / none / "keep what's there"), and it must be the **first** option so it is the default highlight — an accidental `enter` then declines instead of committing the user to something.

## One surface, one route

Each surface reaches the inbox through exactly one pipeline. This route map is what makes every step's pick decidable:

| Surface | Route into the inbox | Set up in |
|---|---|---|
| Error tracking | native signal source | step 4 |
| Support tickets | native signal source | step 4 |
| Setup health | native signal source | step 4 |
| Session replay | Replay Vision scanners | step 6c |
| A connected tool (issues, tickets, DB performance, reviews, search) | its warehouse source, then its responder | step 5 |
| Everything else worth watching | the scout troop, through step 4's scout gate | steps 6 and 6b |

A surface's coverage comes from its own row and nowhere else. That is what settles the error-tracking and session-replay **scouts** in step 6 — their surfaces are routed already — and what makes step 6b's gap analysis count those two as covered. A second pipeline on one surface produces the same finding twice, not more coverage.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Each step file lists the exact string to emit when it starts. Use them — they're cheap. Don't invent your own.

## Abort statuses

Report aborts with `[ABORT]`-prefixed messages. The wizard catches these, renders a friendly explanation, and stops the run — don't halt yourself. The exact strings (the wizard matches them verbatim):

- `[ABORT] self-driving is not available for this project`
- `[ABORT] github connection declined`
- `[ABORT] requires-interactive-mode`

Tool failures on individual sources or scouts are **not** abort conditions — record them as follow-ups and keep going. Only the three cases above end the run.

## Framework guidelines

{commandments}
