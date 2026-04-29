# Step 5 — Generate the audit report

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth.

## TodoWrite

Mark `Audit` as `completed` and `Report` as `in_progress`. After the report `Write` succeeds, mark `Report` as `completed` too.

## Status

Emit:

```
[STATUS] Writing audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Do not invent entries that aren't in the JSON; do not omit entries that are. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

Three sections in this order: **Summary** (counts + problematic items only), **Recommended Actions** (prioritized fixes with file:line), **Full Audit** (everything checked, including passes).

<wizard-report>
# PostHog Audit Report

## Summary

[1–2 sentence overview: runtimes covered (client/server/both), overall health.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have)

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Item | File | Details |
|----------|------|------|------|---------|
| `error` | Installation | [check] | [file:line] | [details] |

If there are no problematic items, write `_No issues found._`.

## Recommended Actions

[Numbered list, ordered by priority — errors first, then warnings, then suggestions. Each item references the offending file:line and what to change.]

## Full Audit

### Installation
| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Identification
| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Event Capture
| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-report.md>
```
