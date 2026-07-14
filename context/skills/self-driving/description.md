# PostHog Self-driving setup

This skill configures PostHog Signals for a project that already has PostHog installed: it switches on the signal sources (the inbox's "Responders") that match what the product actually uses, makes sure the GitHub integration is connected so Signals can research and fix issues in code, tunes the scout troop, designs custom scouts for the watchable surfaces the built-in troop doesn't cover (always proposed to the user first). Organization-level AI data processing approval — which everything downstream depends on — is enforced by the wizard itself before this skill runs.

The wizard's run prompt supplies the project URLs (integrations settings, organization AI settings, new warehouse source, Signals inbox). Use those exact URLs whenever a step sends the user to the browser.

## Workflow

The setup runs as a 9-step chain:

{workflow}

Each step file points to the next. Run them in order. **Start by reading `references/1-check-access.md`** (relative to this skill's directory — typically `.claude/skills/self-driving-setup/references/1-check-access.md`). Don't read ahead. Don't re-read a step once you've passed it. Don't re-read SKILL.md.

## Ground rules

- **Trust the setup report.** `./posthog-setup-report.md` is ground truth for what is instrumented. Scan the codebase only for what the report won't cover.
- **Every write must be idempotent.** List before you create. A duplicate `inbox-source-configs-create` returns 400 — recover by finding the existing row's `id` and calling `inbox-source-configs-partial-update` with `enabled: true`.
- **Never disable a source the user already enabled.** You only switch things on (and tune scouts off); existing enabled rows are someone's deliberate choice.
- **Never enable a connected-tool source the user hasn't confirmed they use.** GitHub Issues, Linear, Zendesk, pganalyze, and Jira are ask-then-connect, never blind.
- **Stay off the internal surfaces.** Don't call `signals-scout-emit-signal` or any scratchpad-write tool, and don't change a scout's `emit` flag or `run_interval_minutes` — on configs, this skill only flips `enabled`. **Built-in scout bodies are never edited.** New scout skills are created in exactly one place: step 6b, and only ones the user approved there.
- **Keep the scout troop small.** Every enabled scout is a recurring LLM spend. Step 6 enables only `signals-scout-general` plus the **one or two** specialists for the products this project uses most — never error tracking or session replay (those reach the inbox as native sources) — and step 6b adds **at most two** custom scouts. Everything else stays disabled.
- **Batch your questions.** `wizard_ask` has a small per-run budget; one multi-select beats four yes/nos. Don't skip a step or drop a connector (e.g. Linear) or custom scouts setup to save calls.
- **The "too many in a row / batch your questions" error is a soft nudge, not the budget running out — retry it.** `wizard_ask` raises it once, on a call it thinks should have been batched. Your genuinely sequential asks — the Linear / GitHub-Issues connector confirms in step 5, and above all the custom-scouts proposal in step 6b — can't be batched (each depends on an earlier answer or on analysis done in between), so **re-issue the exact same call once and it goes through.** Only a `cap reached (N calls)` error means the budget is actually spent. Never record a step as a follow-up — least of all the custom scouts — just because you hit the batch nudge; that silently drops real work the user wanted.
- **Decline goes first.** Every `wizard_ask` that offers choices must include a plain-language decline option (skip / none / "keep what's there"), and it must be the **first** option so it is the default highlight — an accidental `enter` then declines instead of committing the user to something. The **one exception is step 3's GitHub gate**: the run cannot proceed without GitHub, so there the affirmative ("Done — I've installed it") stays first and the decline ("I can't connect right now", which aborts) stays last.

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
