---
next_step: null
---

# Step 6 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing identify audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-identify-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes and optimizations with `file:line` where applicable.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — short closing block explaining what this audit covered.

For the Full audit section, group rows by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. This skill produces four areas: **Identification** (fix), **Identification — Lifecycle** (quality), **Identification — Optimize** (cost), and **Identification — Server SDK** (server-side hygiene). Render whatever areas the ledger actually contains.

For each area, write a one-paragraph framing immediately under the area heading, then the table.

## Report template

<wizard-report>
# PostHog Identify Audit Report

## Summary

[1–2 sentence overview: runtimes covered (client/server/both), overall identify health, and which lens — fix, optimize, or both — surfaced issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have / cost savings)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Identification | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your $identify setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by area within a severity (Identification → Identification — Lifecycle → Identification — Optimize → Identification — Server SDK). Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the data-quality or cost consequence. For fix-side checks: which downstream artifact (funnels, retention, person count, experiments) this finding contaminates. For optimize-side checks: the billing or volume impact, quoting the ratio or count from `details`.
3. **How to fix** — one short imperative sentence pointing at `file:line` (or "no specific code site — adjust SDK config" for MCP-only findings) and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

Suggested docs URLs:
- Identification fix checks (including `identify-sequential-calls`) → https://posthog.com/docs/getting-started/identify-users
- `identify-set-discipline`, `identify-alias-usage` → https://posthog.com/docs/getting-started/identify-users
- `identify-groupidentify-correctness` → https://posthog.com/docs/product-analytics/group-analytics
- `identify-person-profiles-mode`, `server-process-person-profile` → https://posthog.com/docs/data/anonymous-vs-identified-events
- `identify-isidentified-guard`, `identify-duplicate-identify-per-session`, `identify-duplicate-groupidentify-per-session` → https://posthog.com/docs/product-analytics/cutting-costs
- `server-sdk-flush-on-exit` → https://posthog.com/docs/libraries/node (and language equivalents — `python`, `ruby`, `go`, `cloudflare-workers`)
- `server-set-without-identify` → https://posthog.com/docs/getting-started/identify-users

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Identification

This area covers correctness of `posthog.identify()` itself: that the distinct_id is stable, that identify runs before captures and flag evals, that client and server runtimes share the same identity, and that logout flows clear PostHog state.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Identification — Lifecycle

This area covers how identify-adjacent APIs are used over time: whether `$set` vs `$set_once` is chosen correctly (and not fired on every capture or render), whether `alias()` is being used redundantly alongside modern `identify()`, and whether `group()` / `groupIdentify()` are called with valid configured group types, stable keys, and reasonable placement.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Identification — Optimize

This area covers cost-side `$identify` health: whether the `person_profiles` setting matches actual traffic shape (identified vs anonymous), whether identify calls are guarded against repeat firing on every page load, and whether `$identify` and `$groupidentify` are duplicating themselves within sessions. Optimize checks use the PostHog API/MCP to read the operator's tenant; rows showing `mcp_skipped: true` in `details` indicate MCP was unavailable.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Identification — Server SDK

This area covers server-side identity hygiene: whether backend `capture()` calls disable person processing where appropriate (preventing silent property corruption like `$os = "Linux"` on macOS users' profiles), whether serverless / edge / worker processes flush the SDK buffer before exit (preventing event loss), and whether server-side `$set` properties are paired with a canonical `identify()` (preventing orphan profiles). Only runs when a server-side SDK is detected.

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

This audit ran the PostHog `audit-identify` skill — a focused, read-only check of $identify health across three lenses: **fix** (correctness), **optimize** (cost), and **server SDK** (backend identity hygiene). Fix and server-SDK checks scan the project source; optimize checks additionally query the PostHog project via MCP in read-only mode (and gracefully skip when MCP is unavailable). Server-SDK checks only run when a server-side PostHog SDK is detected.

- `error` items break correctness now (identity broken, captures merged across users). Fix first.
- `warning` items work today but cause subtle bugs or noticeably elevated cost. Fix when convenient.
- `suggestion` items are best-practice improvements or cost-savings opportunities with measurable upside.

Re-run `posthog-wizard audit-identify` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-identify-report.md>
```
