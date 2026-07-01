---
next_step: 2-baseline.md
---

# Step 1: Parse the audit report into a remediation plan

This step locates `posthog-audit-report.md`, extracts every finding, classifies each one, and writes the plan to `/tmp/posthog-remediation-plan.json`. It does NOT edit any source file (steps 3–4 own edits), does NOT run any project toolchain command (step 2 owns that), and does NOT read project source beyond the report itself.

## Status

Emit:

```
[STATUS] Locating audit report
[STATUS] Building remediation plan
```

## Action

### a. Locate the report

`Read` `posthog-audit-report.md` at the project root. If it's not there, run **one** `Glob` for `**/posthog-audit-report.md` (ignore matches under `node_modules`, `.next`, `dist`, `build`) and read the first match. If no report exists anywhere, emit `[ABORT] No audit report found` and stop — the operator must run the `audit-3000` skill first.

### b. Extract findings

The report has a **Problematic items** table (one row per non-pass finding: Severity, Area, Check, File, Details) and a **Recommended actions** section (one numbered sub-section per finding with **Diagnosis**, **Why it matters**, **Currently**, **Recommended**, and **Sources** parts). For each table row, find its matching Recommended-actions sub-section by area + check name and build one plan item:

- `id`: kebab-case slug of the check name (e.g. `cross-runtime-distinct-id`).
- `severity`, `area`, `check`: from the table row.
- `files`: every `path:line` mentioned in the row's File column **and** in the sub-section's Diagnosis (a finding can span several files).
- `summary`: the Diagnosis, condensed to one or two sentences.
- `recommendation`: the full Recommended block, verbatim, including fenced code snippets.

A table row with no matching sub-section still becomes an item — `recommendation` stays empty and classification falls through to `skip` below. Findings under **Use case expansion & cross-sell** that already appear in the table (gap-mode rows) are the same item; do not duplicate them.

### c. Classify each item

Apply these rules in order; first match wins:

1. **`posthog-side`** — the fix mutates PostHog state rather than the codebase: editing or renaming insights/dashboards, disabling or archiving feature flags, changing project settings, granting MCP scopes. `skip_reason`: "requires PostHog-side change — rendered as copy-paste prompt in the final report". Note: an event-name mismatch where the report recommends **renaming in code** is NOT this class — that's `auto-fix`. Only when the report recommends editing the PostHog insight does it land here.
2. **`skip`** — any of: a greenfield adoption finding (a PostHog product with no existing usage and no named code surface — e.g. "adopt Surveys", "adopt Logs", "adopt LLM Observability", "add Feature Flags"); a purely stylistic rename that would orphan existing PostHog insights (e.g. past-tense → present-tense event naming migration); an empty `recommendation`. Record the specific `skip_reason`.
3. **`auto-fix`** — everything else: `error` and `warning` items with a concrete file-level recommendation, plus `suggestion` items that are pure init-config additions (e.g. `session_recording` options) or additive instrumentation on a surface the report names by file (e.g. `captureException` in an existing catch block, a `capture` call on a named page).

### d. Write the plan

`Write` `/tmp/posthog-remediation-plan.json`:

```json
{
  "report_path": "<path the report was read from>",
  "project_root": "<directory containing the report>",
  "items": [
    {
      "id": "...", "severity": "...", "area": "...", "check": "...",
      "files": ["path:line"], "summary": "...", "recommendation": "...",
      "classification": "auto-fix|posthog-side|skip",
      "skip_reason": null, "status": "planned", "notes": null
    }
  ]
}
```

`status` is `planned` for `auto-fix` items and `skipped` for everything else.

## Output

The plan file exists and its item count equals the Problematic-items row count. Finish by emitting:

```
[STATUS] Plan ready: <N> auto-fix, <M> posthog-side, <K> skipped
```
