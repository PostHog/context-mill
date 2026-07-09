---
next_step: null
---

# Step 4 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing event capture audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-events-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes and optimizations with `file:line` where applicable.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — short closing block explaining what this audit covered.

For the Full audit section, group rows by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. This skill produces two areas: **Event Capture** (fix) and **Event Capture — Optimize** (cost). Render whatever areas the ledger actually contains.

For each area, write a one-paragraph framing immediately under the area heading, then the table.

## Report template

<wizard-report>
# PostHog Event Capture Audit Report

## Summary

[1–2 sentence overview: runtimes covered (client/server/both), overall event capture health, and which lens — fix, optimize, or both — surfaced issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have / cost savings)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Event Capture | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your event capture setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by area within a severity (Event Capture → Event Capture — Optimize). Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality or cost consequence. For fix-side checks: which downstream artifact (funnels, retention, dashboards, experiments) this finding contaminates. For optimize-side checks: the billing or volume impact, quoting the ratio or count from `details`.
3. **How to fix** — one short imperative sentence pointing at `file:line` (or "no specific code site — adjust SDK config" for MCP-only findings) and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

Suggested docs URLs:
- `capture-event-names-static`, `event-naming-standardization`, `event-duplicates-and-bloat`, `event-quality-context-review` → https://posthog.com/docs/product-analytics/best-practices
- `event-usage-coverage`, `events-pageview-defaults`, `events-env-pollution` → https://posthog.com/docs/product-analytics/cutting-costs

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Event Capture

This area covers correctness and quality of `posthog.capture()` call sites: that event names are static strings, that naming follows a consistent convention, that there are no duplicate or kitchen-sink events, and that the captures themselves don't leak PII, high-cardinality values, JSON-stringified blobs, or fire from hot paths.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Event Capture — Optimize

This area covers cost-side event capture health: whether captured events are actually used in downstream PostHog artifacts (insights, dashboards, cohorts, experiments), whether pageview / pageleave defaults are dominating event volume on high-traffic SPAs, and whether dev / staging environments are leaking events into the production project. Optimize checks use the PostHog API/MCP to read the operator's tenant; rows showing `mcp_skipped: true` in `details` indicate MCP was unavailable.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat the heading + paragraph + table for each area in ledger order, in case future versions of this skill add new areas.]

### Assumptions and blind spots

Under each area's table above, render a `### Assumptions and blind spots` subsection per the investigation standards in `posthog-best-practices/references/investigation-standards.md` (standard 3). Answer the four questions in plain prose, ≤4 sentences total:
- Which code paths or files this area did NOT check that could change the findings.
- Which runtime assumptions are unproven by the static code (mount order, async timing, route gating).
- Alternative explanations for the patterns the checks flagged.
- What you would verify in the live PostHog project (event volumes, property fill rates, dashboard usage) to confirm or refute the most important findings.

When an area produced only `pass` rows, write `_No findings to qualify; the standard checks for this area passed cleanly._` and skip the four-question rundown.

## About this audit

This audit ran the PostHog `audit-events` skill — a focused, read-only check of event capture health across two lenses: **fix** (correctness and quality) and **optimize** (cost). Fix checks scan the project source; optimize checks additionally query the PostHog project via MCP in read-only mode (and gracefully skip when MCP is unavailable).

- `error` items break correctness now (dynamic event names, broken contracts). Fix first.
- `warning` items work today but cause subtle bugs, data-quality problems, or noticeably elevated cost. Fix when convenient.
- `suggestion` items are best-practice improvements or cost-savings opportunities with measurable upside.

Re-run `posthog-wizard audit-events` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-events-report.md>
```
