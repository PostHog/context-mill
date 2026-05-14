# PostHog Audit 3000

This skill audits an existing PostHog integration for **data integrity** across SDK install, init, identification, event capture, event quality, feature-flag hygiene, session replay (correctness + cost), customer enrichment, use-case matching, and product-expansion / cross-sell opportunities (Step 9 layers **codebase** competitor/gap detection with **playbook** priorities from Step 8 when `/tmp/posthog-use-case-match.json` is present). **Read-only** — the only file you create is **one** final audit report at the project root (`posthog-audit-report.md`). Intermediate artifacts live in `/tmp/` while the chain runs (e.g. Step 7’s `co.json` / `pe.json`, staged enrichment markdown, Step 8’s playbook snapshot). Step 8 reads the raw provider JSON; Steps 9–10 consume the staged/playbook files for expansion and the final report. **Step 10** deletes all of these `/tmp/` paths plus the ledger — nothing stays under `/tmp/` or the repo root except the final report. The audit never mutates PostHog state and never edits project source; for actionable cleanup, the final report includes copy-paste prompts the operator can run.

Perform the checks described in the referenced skills and only the events referenced in the skills.

## Workflow

The audit runs as a step chain. **The exact step list lives in the reference files themselves, not in this overview** — the canonical sequence is whatever the chain walks. Step 1 lives at `references/1-version.md`; each step file ends with a `next_step:` frontmatter pointer to the next, and the final step has `next_step: null`. Follow them in the order they point. You must resolve each step in order before any source-tree exploration.

The audit ledger is seeded by the wizard with one pending check per audit area. The set of seeded check ids depends on the wizard version, not on this skill — newer wizards may seed more checks than older ones. **Each step gracefully handles a missing check id**: if a step's expected id is not in the ledger, it skips its `audit_resolve_checks` call for that id and continues. Use `mcp__wizard-tools__audit_resolve_checks` to patch each check as you finish it.

**Start by reading the path relative to this file at `references/1-version.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the audit needs (`Glob`, `Grep`, `Read`, `Write`, `Bash`, and the named `mcp__wizard-tools__audit_*` tools) is already named in this skill.

**Do not call `TodoWrite`.** The audit doesn't track its own task list — progress comes from the audit ledger plus `[STATUS]` lines.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Scanning manifests
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Task` subagents when a step says so.

### Check entry shape

- `id` — stable kebab-case slug. Reuse the existing seeded ids exactly when calling `audit_resolve_checks`.
- `area` — short group name. The current core workflow uses `Installation`, `Identification`, and `Event Capture`.
- `label` — short human name.
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location.
- `details` — optional one-line explanation.

After the final step writes the report, delete `.posthog-audit-checks.json`.

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
