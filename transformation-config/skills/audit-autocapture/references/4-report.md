---
next_step: null
---

# Step 4 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing autocapture audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-autocapture-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes and optimizations with `file:line` where applicable.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — short closing block explaining what this audit covered.

For the Full audit section, group rows by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. This skill produces two areas: **Autocapture** (fix) and **Autocapture — Optimize** (cost). Render whatever areas the ledger actually contains.

For each area, write a one-paragraph framing immediately under the area heading, then the table.

## Report template

<wizard-report>
# PostHog Autocapture Audit Report

## Summary

[1–2 sentence overview: which SDK(s) configure autocapture, overall autocapture health, and which lens — fix, optimize, or both — surfaced issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have / cost savings)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Autocapture | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your autocapture setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by area within a severity (Autocapture → Autocapture — Optimize). Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality or cost consequence. For fix-side checks: which downstream artifact (privacy posture, event quality, captured PII) this finding contaminates. For optimize-side checks: the billing or volume impact, quoting the ratio or count from `details`.
3. **How to fix** — one short imperative sentence pointing at `file:line` (or "no specific code site — adjust SDK config" for MCP-only findings) and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

Suggested docs URLs:
- `autocapture-intentional`, `autocapture-mask-config`, `autocapture-allowlists` → https://posthog.com/docs/product-analytics/autocapture
- `autocapture-ratio-to-custom`, `autocapture-copied-text`, `autocapture-dead-clicks-vs-heatmap` → https://posthog.com/docs/product-analytics/cutting-costs

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Autocapture

This area covers correctness of the autocapture setup itself: whether autocapture is intentionally configured (not silently enabled on a sensitive project), whether PII masking is left on for projects rendering forms, and whether allowlists or ignorelists are in place on high-traffic projects.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Autocapture — Optimize

This area covers cost-side autocapture health: whether `$autocapture` dominates event volume relative to custom events, whether `capture_copied_text` is enabled on a high-traffic site, and whether `capture_dead_clicks` is paying for events that PostHog heatmaps already capture for free. Optimize checks may use the PostHog API/MCP to read the operator's tenant; rows showing `mcp_skipped: true` in `details` indicate MCP was unavailable.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

[Repeat the heading + paragraph + table for each area in ledger order, in case future versions of this skill add new areas.]

## About this audit

This audit ran the PostHog `audit-autocapture` skill — a focused, read-only check of autocapture health across two lenses: **fix** (correctness) and **optimize** (cost). Fix checks scan the project source; optimize checks additionally query the PostHog project via MCP in read-only mode (and gracefully skip when MCP is unavailable).

- `error` items break correctness now (PII leaks, broken privacy posture). Fix first.
- `warning` items work today but cause subtle bugs or noticeably elevated cost. Fix when convenient.
- `suggestion` items are best-practice improvements or cost-savings opportunities with measurable upside.

Re-run `posthog-wizard audit-autocapture` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-autocapture-report.md>
```
