# PostHog Audit — Attribution

This skill audits a PostHog integration's **marketing attribution capture** for data integrity. **Read-only** — the only file you create is the final audit report.

The check space here covers patterns the other audit skills don't: UTM survival across client-side routing and OAuth redirects, custom click-id capture (`gclid`, `fbclid`, `msclkid`), cross-subdomain identity, cookieless-mode tradeoffs against attribution measurement, and consent-banner load ordering. Failures here look like "ad-spend money disappears between ad click and signup event" — silent, expensive, and hard to debug after the fact.

## Workflow

The audit runs as a 4-step chain: Presence → Attribution capture (fix) → Attribution configuration → Report. Each step file ends with a pointer to the next. Follow them in order. Resolve each in order before any source-tree exploration.

**Start by reading the path relative to this file at `references/1-presence.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the audit needs (`Glob`, `Grep`, `Read`, `Write`, `Bash`, and the named `mcp__wizard-tools__audit_*` tools) is already named in this skill.

**Do not call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`.** The audit doesn't track its own task list — progress comes from the audit ledger plus `[STATUS]` lines.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Detecting attribution surfaces
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Audit checks ledger

The ledger lives at `.posthog-audit-checks.json` and is rendered live in the "Audit plan" tab. It is owned by MCP tools — **never `Write` this file directly**:

- `mcp__wizard-tools__audit_resolve_checks({ updates })` — patch one or more checks by `id`. Each `update` is `{ id, status, file?, details? }`. Batch updates from the same step into a single call.

All audit ledger calls are atomic and serialize internally — **concurrent calls from parallel subagents cannot lose updates**, so feel free to fan out runtime checks across `Agent` subagents when a step says so.

### Check entry shape

- `id` — stable kebab-case slug. Reuse the existing seeded ids exactly when calling `audit_resolve_checks`.
- `area` — short group name. This skill uses `Attribution` (fix) and `Attribution — Configuration` (config).
- `label` — short human name.
- `status` — `pending` | `pass` | `error` | `warning` | `suggestion`.
- `file` — optional `path:line` for findings tied to a location.
- `details` — optional one-line explanation (or compact JSON for structured findings).

After the report is written (Step 4), delete `.posthog-audit-checks.json`.

## Severity levels

- `error`: Must fix. Broken attribution or guaranteed data corruption.
- `warning`: Should fix. Pattern that causes silent attribution loss or measurement degradation.
- `suggestion`: Nice to have. Best-practice improvement or coverage gap on a non-critical attribution surface.

## Investigation standards

Every finding produced by this skill must meet the standards in [posthog-best-practices/references/investigation-standards.md]: provenance on every claim, verification evidence inline, and adversarial self-review per area in the report. The skill's grep patterns and rule prose enforce provenance and evidence; the report step renders the per-area "Assumptions and blind spots" subsection.

## Key principles

- **Read-only**: Do not edit project source files. The only file you create is the audit report.
- **Evidence-based**: Reference specific `file:line` for every non-pass finding.
- **Actionable**: Every finding states what to fix and how.
- **Conservative on tenant-shape inference**: when there's no static signal that a project runs paid ad campaigns (no ad-platform pixels, no campaign-tracking parameters anywhere in the code, no marketing-site routes), resolve campaign-only checks with `pass` and `details: "skip: no paid-acquisition signal detected"` rather than warning on absence.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.
- PostHog SDK initialization not found

## Framework guidelines

{commandments}
