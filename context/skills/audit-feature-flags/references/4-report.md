---
next_step: null
---

# Step 4 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing feature flag audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-feature-flags-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes and optimizations with `file:line` where applicable.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — short closing block explaining what this audit covered.

For the Full audit section, group rows by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. This skill produces two areas: **Feature Flags** (fix) and **Feature Flags — Optimize** (cost). Render whatever areas the ledger actually contains.

For each area, write a one-paragraph framing immediately under the area heading, then the table.

## Report template

<wizard-report>
# PostHog Feature Flags Audit Report

## Summary

[1–2 sentence overview: runtimes covered (client/server/both), whether local evaluation is in use, and which lens — fix, optimize, or both — surfaced issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have / cost savings)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Feature Flags | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your feature flag setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by area within a severity (Feature Flags → Feature Flags — Optimize). Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the correctness or cost consequence. For fix-side checks: which user-facing artifact (flicker, wrong variant, runtime error) this finding causes. For optimize-side checks: the billing or volume impact, quoting the ratio or count from `details`.
3. **How to fix** — one short imperative sentence pointing at `file:line` (or "no specific code site — adjust SDK config" for MCP-only findings) and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

Suggested docs URLs:
- `ff-bootstrap-when-known-set` → https://posthog.com/docs/feature-flags/bootstrapping
- `ff-await-readiness`, `ff-default-values` → https://posthog.com/docs/feature-flags/best-practices
- `ff-active-but-unreferenced` → https://posthog.com/docs/feature-flags/cutting-costs
- `ff-local-eval-polling-interval`, `ff-local-eval-in-edge-handlers` → https://posthog.com/docs/feature-flags/local-evaluation
- `ff-test-ci-gating` → https://posthog.com/docs/feature-flags/cutting-costs

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Feature Flags

This area covers correctness of feature flag usage: that flags are bootstrapped when an initial set is known at app start, that flag-eval calls await readiness (so they don't fire before flags load and misread `undefined`), and that every flag-eval has a sensible default fallback for loading-window, network-failure, and quota-limited scenarios.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Feature Flags — Optimize

This area covers cost-side `/flags` health: unreferenced-but-active flags that continue to evaluate (and bill) on every request, the local-evaluation polling interval (defaults to 30s = ~864k credits/month at constant load), local evaluation running inside edge/Lambda handlers (which negates the polling cache), and test/CI gating to prevent silent `/flags` accrual in test runs. Optimize checks that target server-side local evaluation are skipped as `pass` when local evaluation is not detected. MCP-backed checks resolve as `suggestion` with `mcp_skipped: true` in `details` when PostHog MCP is unavailable.

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

This audit ran the PostHog `audit-feature-flags` skill — a focused, read-only check of feature flag health across two lenses: **fix** (correctness) and **optimize** (cost). Fix checks scan the project source; optimize checks additionally query the PostHog project via MCP in read-only mode (and gracefully skip when MCP is unavailable). The billed endpoint is `/flags` (the renamed `/decide`).

- `error` items break correctness now (flicker, wrong variant, runtime error). Fix first.
- `warning` items work today but cause subtle bugs or noticeably elevated cost. Fix when convenient.
- `suggestion` items are best-practice improvements or cost-savings opportunities with measurable upside.

Re-run `posthog-wizard audit-feature-flags` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-feature-flags-report.md>
```
