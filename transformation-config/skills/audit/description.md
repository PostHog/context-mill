# PostHog Audit

This skill audits an existing PostHog integration. **Read-only** — the only file you create is the final audit report.

The audit covers two layers:

1. **Basics** — 9 pre-seeded checks for SDK installation, init correctness, identification, and event capture (data-integrity rules every project needs).
2. **Product surfaces** — feature flags, error tracking, session replay, experiments, and product-analytics extras are added at runtime *only if* the project uses those products. Discovery + the corresponding rule set come from the bundled `posthog-best-practices` skill.

## Workflow

The audit runs as a 3-step chain. Each step file ends with a pointer to the next. Follow them in order.

The audit ledger is already seeded with the 9 basic checks. Step 1 resolves them via three parallel subagents (1.a SDK / 1.b Identification / 1.c Event Capture). Step 2 detects which PostHog products the project uses, calls `mcp__wizard-tools__audit_add_checks` to register per-product checks derived from the best-practices rules, then dispatches a parallel subagent per detected product to resolve them. Step 3 renders the report from the ledger.

**Start by reading `references/1-basics.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:TodoWrite`). Do **not** use it to browse for other tools — every tool the audit needs (`TodoWrite`, `Task`, `Glob`, `Grep`, `Read`, `Write`, `Bash`, and the named `mcp__wizard-tools__*` tools) is already named in this skill.

## Task list

Use TodoWrite **only** at phase boundaries. Pass the list below directly as the `todos` argument — it is an **array of objects**, not a JSON string:

```
todos: [
  { content: "Audit",  status: "in_progress", activeForm: "Running audit" },
  { content: "Report", status: "pending",     activeForm: "Writing report" }
]
```

Two TodoWrite calls total: open the list at the start of Step 1, advance to `Report` (Step 3). **Do not call TodoWrite to update the spinner.**

### Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Discovering PostHog product surfaces
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_add_checks({ checks })` — append new pending checks. Used in Step 2 after planning per-product rules. Atomically rejects duplicate ids.
- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same subagent into a single call.

All ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Task` subagents when a step says so.

## Parallelism

Issue independent tool calls **in a single message** whenever the step allows it — parallel `Read`s, parallel `Grep`s, or multiple `Task` subagents at once. The wizard pipes them through concurrently. Step 1 dispatches three parallel basics subagents. Step 2 dispatches one parallel subagent per detected product.

### Check entry shape

- `id` — stable kebab-case slug. The 9 basics are pre-seeded and you reuse those ids when resolving. New product checks added in Step 2 use the format `<best-practices-file-stem>:<line-number>` (e.g. `feature-flags:9`, `error-tracking:11`) so each entry is traceable back to its source rule.
- `area` — short group name. Basics use `Installation`, `Identification`, `Event Capture`. Product additions use Title-Case file stems: `Feature Flags`, `Error Tracking`, `Session Replay`, `Experiments`, `Product Analytics`. New `area` values are fine — the report groups dynamically by whatever shows up.
- `label` — short human name (≤ 60 chars).
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location.
- `details` — optional one-line explanation.

After the report is written (Step 3), delete `.posthog-audit-checks.json`.

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
