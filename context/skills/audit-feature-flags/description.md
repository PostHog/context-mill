# PostHog Audit — Feature Flags

This skill audits an existing PostHog integration's **feature flag usage** for both correctness (fix) and cost-optimization (optimize). **Read-only** — the only file you create is the final audit report. The audit never mutates PostHog state and never edits project source.

The audit covers two lenses:

- **Fix** — correctness checks on flag bootstrapping, readiness/race conditions, and default-value fallbacks. These prevent flicker, mis-evaluation, and runtime errors when flags fail to load.
- **Optimize** — cost-side checks on unreferenced active flags, local-evaluation polling interval, local evaluation inside edge/Lambda handlers, and test/CI gating of flag fetches. These use PostHog MCP to read the operator's tenant where applicable; they gracefully skip if MCP is unavailable.

The billed feature flag endpoint is `/flags` (the renamed `/decide`). All references to the "decide endpoint" in older docs map to `/flags`.

## Workflow

The audit runs as a step chain. **The exact step list lives in the reference files themselves, not in this overview.** Step 1 lives at `references/1-presence.md`; each step file ends with a `next_step:` frontmatter pointer to the next, and the final step has `next_step: null`. Follow them in the order they point. You must resolve each step in order before any source-tree exploration.

The audit ledger is seeded by the wizard with one pending check per feature flag check. **Each step gracefully handles a missing check id**: if a step's expected id is not in the ledger, it skips its `audit_resolve_checks` call for that id and continues. Use `mcp__wizard-tools__audit_resolve_checks` to patch each check as you finish it.

**Start by reading the path relative to this file at `references/1-presence.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the audit needs (`Glob`, `Grep`, `Read`, `Write`, `Bash`, the named `mcp__wizard-tools__audit_*` tools) is already named in this skill. The optimize-side checks reach PostHog through its single `exec` tool, described in the optimize reference.

**Do not call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`.** The audit doesn't track its own task list — progress comes from the audit ledger plus `[STATUS]` lines.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Scanning feature flag call sites
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Agent` subagents when a step says so.

### Check entry shape

- `id` — stable kebab-case slug. Reuse the existing seeded ids exactly when calling `audit_resolve_checks`.
- `area` — short group name. This skill seeds two areas: `Feature Flags` (fix) and `Feature Flags — Optimize` (cost).
- `label` — short human name.
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location.
- `details` — optional one-line explanation.

After the final step writes the report, delete `.posthog-audit-checks.json`.

## Severity levels

- `error`: Must fix. Broken functionality, data corruption, or security issue.
- `warning`: Should fix. Pattern that causes subtle bugs or data-quality problems.
- `suggestion`: Nice to have. Best-practice improvement or cost-savings opportunity.

## Key principles

- **Read-only**: Do not edit project source files. The only file you create is the audit report.
- **Evidence-based**: Reference specific `file:line` for every non-pass finding. For MCP-based optimize checks, include the SQL or MCP call summary in `details`.
- **Actionable**: Every finding states what to fix and how.
- **Graceful MCP fallback**: When PostHog MCP is unavailable, optimize checks resolve as `suggestion` with `details: "PostHog MCP unavailable — could not measure X"` and `mcp_skipped: true`. Do not block the audit.
- **Local-evaluation gating**: Some optimize checks only apply when the project uses server-side local evaluation (initialized with a `personal_api_key` / feature-flags secure API key, or calling local-eval-only APIs). Step 1 detects this and downstream checks skip themselves when local eval is not in use.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.

- No PostHog feature flag usage found (no SDK call sites matching the flag-eval API surface)

## Framework guidelines

{commandments}
