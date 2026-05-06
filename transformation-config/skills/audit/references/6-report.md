---
next_step: null
---

# Step 6 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded plus every check the runner added via `audit_add_checks` in Step 5 ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

If any ledger entry is still `pending` at this point (a specialist Task crashed or never resolved its check), patch it via `mcp__wizard-tools__audit_resolve_checks` to `{ status: "warning", details: "specialist did not complete" }` before reading the ledger again — every reportable entry must have a terminal status.

`Write` `posthog-audit-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` and a docs link per item.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — a short closing block explaining what the audit covered and how to interpret the report.

For the Full audit section, group rows dynamically by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. The core audit produces three areas — **Installation**, **Identification**, **Event Capture** — plus whichever areas the second-wave specialists contributed (`Web Analytics`, `Feature Flags`, …). The report must not hard-code that list; render whatever areas appear.

For each area, write a one-paragraph framing immediately under the area heading, then the table. Use the canonical copy below verbatim when the area name matches; otherwise write a one-sentence summary derived from the area's check labels.

## Report template

<wizard-report>
# PostHog Audit Report

## Summary

[1–2 sentence overview: runtimes covered (client/server/both), overall health, and which areas had issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Installation | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your PostHog setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by ledger order within a severity. Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality consequence: which downstream artifact (funnels, retention, person count, billing, replays, experiments, etc.) this finding contaminates if left alone, and how. Use the canonical "why it matters" copy below verbatim when the check id matches; otherwise write one sentence rooted in the check's rule.
3. **How to fix** — one short imperative sentence pointing at `file:line` and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

If there are no actions, write `_Nothing to fix._`.

## Full audit

### [Area from ledger]

[Canonical paragraph for the area, see "Canonical area copy" above. If the area is not in the canonical list, write one short sentence summarizing what its checks verify.]

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat the heading + paragraph + table for each area in ledger order.]

## About this audit

The PostHog wizard runs a stepped chain: SDK installation → init correctness → identification → event capture → dispatch agent + discoverable specialists (web analytics, feature flags, experiments, LLM analytics, error tracking — each gated by the dispatch agent based on actual usage in the project) → this report. Each stage resolves one or more checks against the project's source tree, recording every result — pass or otherwise — in the ledger this report was generated from.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-report.md>
```
