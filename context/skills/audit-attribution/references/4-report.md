---
next_step: null
---

# Step 4 — Generate the audit report

The audit report is rendered **directly from `.posthog-audit-checks.json`** — that file is the source of truth. Every check the wizard seeded for this skill ends up in the report, even passes; nothing is invented.

## Status

Emit:

```
[STATUS] Writing attribution audit report
```

## Action

`Read` the ledger once, then transform every entry into the report below. Use `area`, `label`, `status`, `file`, and `details` from each entry verbatim where the report calls for them.

`Write` `posthog-audit-attribution-report.md` at the project root with the structure shown below. After the report is written, delete `.posthog-audit-checks.json`.

The report has four sections in this order:

1. **Summary** — one-paragraph overview, severity counts, and a problematic-items table.
2. **Recommended actions** — prioritized fixes with `file:line` where applicable.
3. **Full audit** — every check the wizard ran, grouped by `area`, including passes.
4. **About this audit** — short closing block explaining what this audit covered.

For the Full audit section, group rows by each distinct `area` value in the ledger, preserving first-seen area order from the JSON. This skill produces two areas: **Attribution** (fix) and **Attribution — Configuration** (config). Render whatever areas the ledger actually contains.

For each area, write a one-paragraph framing immediately under the area heading, then the table.

## Report template

<wizard-report>
# PostHog Attribution Audit Report

## Summary

[1–2 sentence overview: which surfaces are covered (landing, auth, conversion), overall attribution health, and which lens — fix or configuration — surfaced issues.]

**Counts**

- **Errors**: [N] (must fix)
- **Warnings**: [N] (should fix)
- **Suggestions**: [N] (nice to have)
- **Passes**: [N]

**Problematic items** _(only `error`, `warning`, `suggestion` — no passes)_

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `error` | Attribution | [label] | [file:line] | [details] |

If there are no problematic items, write `_No issues found — your attribution setup looks healthy._` instead of the table.

## Recommended actions

Numbered list, ordered by severity (errors → warnings → suggestions), then by area within a severity (Attribution → Attribution — Configuration). Each item is **three sentences**, in this order:

1. **What's wrong** — the finding, written as a one-sentence diagnosis derived from `details`.
2. **Why it matters** — one sentence on the attribution-data-quality consequence (lost UTM trace, untrackable cross-session signup, broken cross-subdomain identity, missing click-id for conversion API).
3. **How to fix** — one short imperative sentence pointing at `file:line` and the concrete change. End with a docs link.

Format:

1. **[Area] · [label]** — [what's wrong]. _Why it matters:_ [why-it-matters]. _Fix:_ [how-to-fix at `file:line`]. See [docs]([area docs url]).

Suggested docs URLs:
- `attribution-utm-survives-landing`, `attribution-survives-auth-redirect`, `attribution-on-conversion-events`, `attribution-custom-click-ids` → https://posthog.com/docs/data/utm-segmentation
- `attribution-first-touch-set-once` → https://posthog.com/docs/getting-started/identify-users
- `attribution-cross-subdomain-cookie` → https://posthog.com/docs/libraries/js/config
- `attribution-cookieless-mode-impact`, `attribution-consent-integration` → https://posthog.com/docs/privacy/data-collection

If there are no actions, write `_Nothing to fix._`.

## Full audit

### Attribution

This area covers attribution capture quality: whether UTM parameters survive client-side routing and OAuth redirects to reach the signup event, whether project-defined first-touch properties use `$set_once` (not `$set`) so the original-touch value persists, whether ad-platform click ids (`gclid`, `fbclid`, `msclkid`, etc.) are captured for downstream conversion APIs, and whether conversion events are enriched with attribution context.

| Check | Status | File | Details |
|-------|--------|------|---------|
| [label] | [status] | [file] | [details] |

### Attribution — Configuration

This area covers configuration-side attribution health: `cross_subdomain_cookie` on multi-subdomain projects (so marketing-host UTMs follow the user to the app host), `cookieless_mode` and its tradeoff against cross-session attribution, and consent-banner integration with PostHog's opt-in / opt-out APIs.

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

This audit ran the PostHog `audit-attribution` skill — a focused, read-only check of attribution capture health across two lenses: **fix** (capture quality on landing, redirects, conversion events) and **configuration** (cross-subdomain identity, cookieless / consent interactions). All checks scan the project source; none require PostHog MCP access. Attribution checks include conservative skip conditions (`no auth redirect`, `no consent surface`, `no paid-acquisition signal`) so single-host product-only projects don't get noisy warnings.

- `error` items break attribution now (broken cross-subdomain identity, guaranteed UTM loss). Fix first.
- `warning` items work today but cause silent attribution loss (un-preserved UTMs through auth, missing click ids, cookieless × paid-acquisition mismatch). Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside on ad-spend attribution.

Pair with `posthog-wizard audit identify` for the identity-resolution side (which is where many attribution failures actually manifest as blocked merges), and with `posthog-wizard audit events` for the conversion-event taxonomy side.

Re-run `posthog-wizard audit attribution` after applying fixes to refresh the ledger.

</wizard-report>

After the report is written, emit a final line so the wizard can surface the path to the user:

```
Created audit report: <absolute path to posthog-audit-attribution-report.md>
```
