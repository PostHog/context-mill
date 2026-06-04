# PostHog events audit

This skill produces a product-browseable report of every PostHog event your code captures, mapped to the codebase area, and enriched with 30-day volume from PostHog.

## Workflow

The audit runs as a 6-step chain (the dashboard step also uploads the report to a PostHog notebook):

1. Detect SDK
2. Scan capture sites (grep only)
3. Enrich (subagent fan-out — the only step that reads source files)
4. Query PostHog for volume
5. Write report
6. Create dashboard, then upload the report to a PostHog notebook

Each step file points to the next. Run them in order. Don't explore the source tree on your own.

**Start by reading `references/1-detect.md`** (relative to this skill's directory – typically `.claude/skills/events-audit/references/1-detect.md`). Don't read ahead. Don't re-read a step once you've passed it. Don't re-read SKILL.md.

Step 1 seeds the audit checklist as its first action. Don't assume the runtime pre-seeds it.

## The audit checklist

The audit checklist is the **pipeline progress ledger** — one row per workflow phase. The seven ids cover the six steps above plus the notebook upload that closes step 6:

- `detect-sdk`
- `scan-sites`
- `enrich-sites`
- `query-volume`
- `write-report`
- `create-dashboard`
- `upload-notebook`

Each step file resolves its own row via `mcp__wizard-tools__audit_resolve_checks` once the step's work is done — that's what advances the spinner in the wizard's sidebar. Don't invent new ids.

The qualitative findings (`identity-segmentation`, `coverage-map`, `data-quality`) live in the **report**, not the ledger. Step 5 computes them straight from the inventory and renders them as report sections; they don't need MCP rows.

The checklist lives at `.posthog-audit-checks.json`. It's owned by MCP tools – **never `Write` it directly**.

## The events inventory

A second file, `.posthog-events-inventory.json`, is the working event inventory for steps 2 through 4. It holds the capture sites with derived `package`/`area`/`route`/`enclosing` fields, event names, properties, and per-event volume from PostHog. 

It's **not** MCP-owned – no `audit_*` tool guards it. The inventory is **transient scratch state**, not a deliverable: step 5 deletes `.posthog-audit-checks.json` once the report is written, and step 6 deletes the inventory after the optional dashboard step. The report is the only artifact the user keeps.

Check entry shape:

- `id` - stable kebab-case slug. The six phase ids are listed above.
- `area` - short group name (one per phase: `Detect SDK`, `Scan capture sites`, `Enrich`, `Query PostHog`, `Write report`, `Create dashboard`).
- `label` - short human name.
- `status` - `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` - unused for phase rows.
- `details` - optional short string the wizard surfaces in the "Audit plan" tab if you want to add context to a non-pass phase (e.g. `query-volume` resolving to `warning` with `details: "PostHog MCP unavailable — report rendered without volume data"`).

## Key principles

- **Show your evidence.** Cite `file:line` for every non-pass finding.
- **Frame findings as product questions.** Every finding describes *what product question or insight it blocks*, not what code rule it breaks.
- **Hand the reader the map. Don't tell the story for them.** The deliverable is a single report with three short qualitative checks plus a few suggested follow-ups. The reader clusters events into flows on demand by asking targeted follow-up questions about the report — the skill doesn't do that synthesis upfront.

## Live activity – `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a sub-step, write a line like:

```
[STATUS] Scanning capture sites
```

The wizard catches these and updates the spinner. Use them freely – they're cheap. Each step file lists the exact strings to emit. Don't invent your own.

## Abort statuses

Report aborts with `[ABORT]` prefixed messages. The wizard catches these and stops the run – don't halt yourself.

- `[ABORT] No PostHog SDK found`
- `[ABORT] No capture call sites found in any detected SDK`

MCP failures (project mismatch, query errors, no connection) are **not** abort conditions — step 4 soft-degrades and step 5 renders the report with a `{{mcp_disclaimer}}` callout in place of volume sections. See step 4 for the degradation contract.

## Framework guidelines

{commandments}
