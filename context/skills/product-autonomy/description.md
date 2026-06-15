# PostHog Product Autonomy setup

This skill configures PostHog Signals for a project that already has PostHog installed: it switches on the signal sources (the inbox's "Responders") that match what the product actually uses, makes sure the GitHub integration is connected so Signals can research and fix issues in code, tunes the scout fleet, designs custom scouts for the watchable surfaces the canonical fleet doesn't cover (always proposed to the user first), and confirms the organization-level AI data processing approval that everything downstream depends on.

The wizard's run prompt supplies the project URLs (integrations settings, organization AI settings, new warehouse source, Signals inbox). Use those exact URLs whenever a step sends the user to the browser.

## Workflow

The setup runs as a 9-step chain:

{workflow}

Each step file points to the next. Run them in order. **Start by reading `references/1-check-access.md`** (relative to this skill's directory — typically `.claude/skills/product-autonomy-setup/references/1-check-access.md`). Don't read ahead. Don't re-read a step once you've passed it. Don't re-read SKILL.md.

## Ground rules

- **Trust the setup report.** `./posthog-setup-report.md` is ground truth for what is instrumented. Scan the codebase only for what the report won't cover.
- **Every write must be idempotent.** List before you create. A duplicate `inbox-source-configs-create` returns 400 — recover by finding the existing row's `id` and calling `inbox-source-configs-partial-update` with `enabled: true`.
- **Never disable a source the user already enabled.** You only switch things on (and tune scouts off); existing enabled rows are someone's deliberate choice.
- **Never enable a connected-tool source the user hasn't confirmed they use.** GitHub Issues, Linear, Zendesk, and pganalyze are ask-then-connect, never blind.
- **Stay off the internal surfaces.** Don't call `signals-scout-emit-signal` or any scratchpad-write tool, and don't change a scout's `emit` flag or `run_interval_minutes` — on configs, this skill only flips `enabled`. **Canonical scout bodies are never edited.** New scout skills are created in exactly one place: step 7b, and only ones the user approved there.
- **Batch your questions.** `wizard_ask` has a small per-run budget; one multi-select beats four yes/nos.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Each step file lists the exact string to emit when it starts. Use them — they're cheap. Don't invent your own.

## Abort statuses

Report aborts with `[ABORT]`-prefixed messages. The wizard catches these, renders a friendly explanation, and stops the run — don't halt yourself. The exact strings (the wizard matches them verbatim):

- `[ABORT] product autonomy is not available for this project`
- `[ABORT] github connection declined`
- `[ABORT] ai data processing approval declined`
- `[ABORT] requires-interactive-mode`

Tool failures on individual sources or scouts are **not** abort conditions — record them as follow-ups and keep going. Only the four cases above end the run.

## Framework guidelines

{commandments}
