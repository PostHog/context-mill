# PostHog events audit

This skill produces a product-browseable report of every PostHog event your code captures, mapped to the codebase by file path and enriched with 30-day volume from PostHog. The reader does the synthesis on demand by asking follow-up questions about the report — the skill itself doesn't cluster events into flows or write per-flow narratives.

The checklist has three shared checks: `identity-segmentation`, `coverage-map`, `data-quality`. Finish each one. Don't invent new ids.

## Workflow

The audit runs as a 6-step chain:

1. Detect
2. Scan
3. Extract
4. Enrich
5. Report
6. Dashboard

Each step file points to the next. Run them in order. Don't explore the source tree on your own.

The wizard seeds the checklist with the three shared checks before you start.

Step 1 confirms the shape and reseeds if it's missing or out of date. As you finish each check, patch it with `mcp__wizard-tools__audit_resolve_checks`.

**Start by reading `references/1-detect.md`** (relative to this skill's directory – typically `.claude/skills/events-audit/references/1-detect.md`). Don't read ahead. Don't re-read a step once you've passed it. Don't re-read SKILL.md.

Some tools are deferred by the SDK – load each once via `ToolSearch select:<name>` before first use: `Read`, `Bash`, `Glob`, `Grep`, `Write`, `mcp__wizard-tools__audit_resolve_checks`, `mcp__wizard-tools__audit_seed_checks`, and the PostHog query tool `mcp__posthog-wizard__query-run`. The dashboard write tools `mcp__posthog-wizard__dashboard-create` and `mcp__posthog-wizard__insight-create` are loaded inside step 6. Use `ToolSearch` to load named tools only – don't browse.

`Agent` is **not** in the default load list. Step 2 is the only place where fan-out is conditional; load `Agent` *inside* step 2, only after deciding to dispatch subagents.

If the wizard prompt names a framework (e.g. "Framework: Flask"), use it to narrow your scans – skip manifests and language patterns that don't apply.

## When to trigger

Trigger when the user asks for an event audit, event inventory, or events documentation; "what events does my code capture"; "find redundant or stale events"; or "which product questions can my data answer."

Don't trigger when the user wants to *add* instrumentation (defer to `instrument-product-analytics`) or debug a single missing event (defer to `diagnosing-missing-recordings`).

## Live activity – `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a sub-step, write a line like:

```
[STATUS] Scanning capture sites
```

The wizard catches these and updates the spinner. Use them freely – they're cheap. Each step file lists the exact strings to emit. Don't invent your own.

## The audit checklist

The checklist lives at `.posthog-audit-checks.json` and shows live in the "Audit plan" tab. It's owned by MCP tools – **never `Write` it directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` - patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Emit one call per check as you finish its analysis – the "Audit plan" tab updates live, so streaming resolutions one-at-a-time gives the user visible progress instead of a single end-of-step flip. Only batch when you genuinely produce two updates in the same model turn (rare).
- `mcp__wizard-tools__audit_seed_checks({ checks })` - replaces the whole checklist atomically. Step 1's fallback uses this when the file is missing or out of date; otherwise don't call it.

A second file, `.posthog-events-inventory.json`, is the working ledger for steps 2 through 4. It holds the capture sites with derived `package`/`area`/`route`/`enclosing` fields, event names, properties, and per-event volume from PostHog. 

It's **not** MCP-owned – no `audit_*` tool guards it. The inventory is **transient scratch state**, not a deliverable: step 5 deletes `.posthog-audit-checks.json` once the report is written, and step 6 deletes the inventory after the optional dashboard step. The report is the only artifact the user keeps.

### Check entry shape

- `id` - stable kebab-case slug. The three shared ids are `identity-segmentation`, `coverage-map`, `data-quality`.
- `area` - short group name. Shared entries use `Identity`, `Coverage`, `Data quality`.
- `label` - short human name.
- `status` - `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` - optional `path:line` for findings tied to a location.
- `details` - Markdown bulleted summary in plain language. Describe state and the product questions blocked. Don't render `status` as a grade in the report; the enum is for filter logic only.

## Key principles

- **Show your evidence.** Cite `file:line` for every non-pass finding.
- **Frame findings as product questions.** Every finding describes *what product question or insight it blocks*, not what code rule it breaks.
- **Hand the reader the map. Don't tell the story for them.** The deliverable is a single report with three short qualitative checks plus a few suggested follow-ups. The reader clusters events into flows on demand by asking targeted follow-up questions about the report — the skill doesn't do that synthesis upfront.

## Abort statuses

Report aborts with `[ABORT]` prefixed messages. The wizard catches these and stops the run – don't halt yourself.

- `[ABORT] No PostHog SDK found`
- `[ABORT] No capture call sites found in any detected SDK`
- `[ABORT] MCP project mismatch – enrichment unsafe`

## Framework guidelines

{commandments}
