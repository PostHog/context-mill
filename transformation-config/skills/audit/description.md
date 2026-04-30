# PostHog Audit

This skill audits an existing PostHog integration for **data integrity** in event capture and identification. **Read-only** — the only file you create is the final audit report.

Scope is intentionally narrow in this version: 9 core checks covering installation, identification, and event capture. Product-specific audits such as feature flags, error tracking, session replay, and experiments are deferred — do not run them or add product-specific subagents in this workflow.

## Workflow

The audit runs as a 5-step chain. Each step file ends with a pointer to the next. The chain is split so the cheapest, highest-signal check (is the SDK installed and current?) resolves **first**, before any source-tree exploration.

**Start by reading `references/1-seed.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:TodoWrite`). Do **not** use it to browse for other tools — every tool the audit needs (`TodoWrite`, `Glob`, `Grep`, `Read`, `Write`, `Bash`, and the named `mcp__wizard-tools__audit_*` tools) is already named in this skill.

## Task list

Use TodoWrite **only** at phase boundaries. Pass the list below directly as the `todos` argument — it is an **array of objects**, not a JSON string:

```
todos: [
  { content: "Setup",  status: "in_progress", activeForm: "Setting up audit" },
  { content: "Audit",  status: "pending",     activeForm: "Running audit" },
  { content: "Report", status: "pending",     activeForm: "Writing report" }
]
```

Three TodoWrite calls total: open the list (Step 1), advance to `Audit` (Step 4), advance to `Report` (Step 5). **Do not call TodoWrite to update the spinner.**

### Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Scanning manifests
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_seed_checks({ checks })` — call once in Step 1 with the full pending checklist.
- `mcp__wizard-tools__audit_add_checks({ checks })` — reserved for future audit extensions that append additional checks after the initial seed. Do not use it in this core-only workflow.
- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Task` subagents when a step says so.

## Parallelism

Issue independent tool calls **in a single message** whenever the step allows it — parallel `Read`s, parallel `Grep`s, or two `Task` subagents at once. The wizard pipes all of them through concurrently. The audit explicitly fans out in Steps 3 (parallel reads) and 4 (two subagents).

### Check entry shape

- `id` — stable kebab-case slug (provided by Step 1's seed; reuse exactly).
- `area` — short group name. The current core workflow uses `Installation`, `Identification`, and `Event Capture`.
- `label` — short human name.
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location.
- `details` — optional one-line explanation.

After the report is written (Step 5), delete `.posthog-audit-checks.json`.

## Severity levels

- `error`: Must fix. Broken functionality, data corruption, or security issue.
- `warning`: Should fix. Pattern that causes subtle bugs or data-quality problems.
- `suggestion`: Nice to have. Best-practice improvement.

## Key principles

- **Read-only**: Do not edit project source files. The only file you create is the audit report.
- **Evidence-based**: Reference specific `file:line` for every non-pass finding.
- **Actionable**: Every finding states what to fix and how.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.
- No PostHog SDK found

## Framework guidelines

{commandments}
