# PostHog Audit

This skill audits an existing PostHog integration for **data integrity** in installation, identification, event capture, and (when applicable) deeper areas like web analytics, feature flags, experiments, LLM analytics, and error tracking. **Read-only** — the only file you create is the final audit report.

Perform the checks described in the referenced step files and only the events referenced there.

## Workflow

The audit runs as a 6-step chain:

1. SDK + version (`references/1-version.md`)
2. Init correctness (`references/2-init.md`)
3. Identification — dispatches `audit-subagents-identification`, waits for it to resolve all 4 identification checks (`references/3-identification.md`)
4. Event capture — dispatches `audit-subagents-event-capture`, waits for it to resolve all 3 event-capture checks (`references/4-event-capture.md`)
5. Dispatch agent + discoverable specialists — the dispatch agent picks which discoverable specialists to run, then the runner enrolls their checks via `audit_add_checks` and fans them out (`references/5-discoverable-dispatch.md`)
6. Read ledger + write report (`references/6-report.md`)

Each step file ends with a pointer to the next. Follow them in the order they are written. Resolve each step's checks before moving to the next. Identification (Step 3) must be fully resolved before Event Capture (Step 4) is dispatched, and both must be fully resolved before the dispatch agent runs.

The audit ledger is seeded by the wizard with 10 pending checks (3 install/init + 4 identification + 3 event-capture). Step 5 may add more checks via `audit_add_checks` for discoverable specialists. Use `mcp__wizard-tools__audit_resolve_checks` to patch each check as it's evaluated. Specialists you dispatch own their own checks — they call `audit_resolve_checks` themselves; you do not patch on their behalf.

**Start by reading the path relative to this file at `references/1-version.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the audit needs (`Glob`, `Grep`, `Read`, `Write`, `Bash`, `Task`, and the named `mcp__wizard-tools__*` tools) is already named in this skill or its step files.

**Do not call `TodoWrite`.** The audit doesn't track its own task list — progress comes from the audit ledger plus `[STATUS]` lines.

## Specialist registries

### Always-on (Steps 3 + 4, pre-seeded by wizard)

| Specialist | Step | Skill ID |
|---|---|---|
| identification | 3 | `audit-subagents-identification` |
| event-capture | 4 | `audit-subagents-event-capture` |

### Discoverable (Step 5, gated by the dispatch agent)

| Area | Skill ID |
|---|---|
| Web Analytics | `audit-subagents-web-analytics` |
| Feature Flags | `audit-subagents-feature-flags` |
| Experiments | `audit-subagents-experiments` |
| LLM Analytics | `audit-subagents-llm-analytics` |
| Error Tracking | `audit-subagents-error-tracking` |

The dispatch agent itself: `audit-subagents-dispatch`.

### Selection overrides

The wizard's `--only` and `--skip` flags inject a "Specialist selection (override defaults):" block into this prompt:
- `--skip` removes specific basic specialists from Step 3 or Step 4 (their pre-seeded checks must still be patched — mirror them as `{ status: "warning", details: "skipped: suppressed by --skip" }` in that step).
- `--only=identification,event-capture` (or any selection block that excludes the dispatch agent) **suppresses Step 5 entirely** — no dispatch agent spawn, no second wave.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Scanning manifests
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call where possible.
- `mcp__wizard-tools__audit_add_checks(<checks>)` — Step 4 only, to enroll discoverable specialists' checks before dispatching them.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Task` subagents.

### Check entry shape

- `id` — stable kebab-case slug. Reuse the existing seeded ids exactly when calling `audit_resolve_checks`.
- `area` — short group name. The current core workflow uses `Installation`, `Identification`, `Event Capture`, plus whatever areas Step 4 adds (`Web Analytics`, `Feature Flags`, etc.).
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
- **Evidence-based**: Reference specific `file:line` for every non-pass finding (or hosts/evidence for query-driven specialists).
- **Actionable**: Every finding states what to fix and how.
- **One report**: Specialists do not write reports of their own. They write to the ledger, the runner reads the ledger and writes the single report in Step 5.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.
- `[ABORT] No PostHog SDK found`

## Framework guidelines

{commandments}
