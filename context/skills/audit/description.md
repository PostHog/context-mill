# PostHog Audit

This skill audits an existing PostHog integration for **data integrity** in event capture and identification. **Read-only** — it creates no files; the audit report is published to the wizard session instead.

Perform the checks described in the referenced skills and only the events referenced in the skills.

## Workflow

The audit runs as a 5-step chain: Installation (SDK + version) → init correctness → identification → event capture → report (which publishes the report with a single `publish_handoff` call). Each step file ends with a pointer to the next. Follow them in the order they are written. You must resolve them in order before any source-tree exploration.

The audit ledger is already seeded with the 12 pending checks (10 correctness checks plus `write-report` and `upload-notebook`, both of which the report step resolves after publishing the report). Use `mcp__wizard-tools__audit_resolve_checks` to patch each one as you finish it.

**Start by reading the path relative to this file at `references/1-version.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the audit needs (`Glob`, `Grep`, `Read`, `Bash`, `publish_handoff`, and the named `mcp__wizard-tools__audit_*` tools) is already named in this skill.

**Do not call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`.** The audit doesn't track its own task list — progress comes from the audit ledger plus `[STATUS]` lines.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Scanning manifests
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Agent` subagents when a step says so.

### Check entry shape

- `id` — stable kebab-case slug. Reuse the existing seeded ids exactly when calling `audit_resolve_checks`.
- `area` — short group name. The current core workflow uses `Installation`, `Identification`, and `Event Capture`.
- `label` — short human name.
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location.
- `details` — optional one-line explanation.

After the report is published (Step 5), delete `.posthog-audit-checks.json`.

## Severity levels

- `error`: Must fix. Broken functionality, data corruption, or security issue.
- `warning`: Should fix. Pattern that causes subtle bugs or data-quality problems.
- `suggestion`: Nice to have. Best-practice improvement.

## Key principles

- **Read-only**: Do not edit project source files. The audit writes no report file — it publishes the report with `publish_handoff`.
- **Evidence-based**: Reference specific `file:line` for every non-pass finding.
- **Actionable**: Every finding states what to fix and how.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.
- No PostHog SDK found

## Framework guidelines

{commandments}
