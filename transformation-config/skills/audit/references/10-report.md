# Step 8 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth.

## Action

Read the file once, then transform every entry into the report below. Do not invent entries that aren't in the JSON; do not omit entries that are. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

Create `posthog-audit-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

## TodoWrite

First, update the in-progress task's `activeForm` to `Writing audit report`. Status and content stay the same.

After the report Write succeeds, mark `Generate audit report` as `completed`.

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

### Installation & Setup
| Check | Status | Details |
|-------|--------|---------|
| [check] | [status] | [details] |

### Identification
| Check | Status | Details |
|-------|--------|---------|
| [check] | [status] | [details] |

### Event Tracking
| Event / Check | File | Status | Notes |
|--------------|------|--------|-------|
| [name] | [file:line] | [status] | [notes] |

### Feature Flags
| Flag / Check | File | Status | Notes |
|-------------|------|--------|-------|
| [name] | [file:line] | [status] | [notes] |

### Error Tracking
| Check | Status | Details |
|-------|--------|---------|
| [check] | [status] | [details] |

### Session Replay
| Check | Status | Details |
|-------|--------|---------|
| [check] | [status] | [details] |

### Experiments
| Experiment / Check | File | Status | Notes |
|-------------------|------|--------|-------|
| [name] | [file:line] | [status] | [notes] |

</wizard-report>

## Status

- Reading `.posthog-audit-checks.json`
- Generating audit report
- Created audit report: [insert full local file path]
