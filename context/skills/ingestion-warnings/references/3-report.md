---
next_step: null
---

# Step 3 — Write the report

The report is rendered **directly from `.posthog-ingestion-warnings.json`** — that file is the source of truth. Every warning the worklist tracked ends up in the report; nothing is invented.

## Status

Emit:

```
[STATUS] Writing ingestion warnings report
```

## Action

`Read` `.posthog-ingestion-warnings.json` once. Transform every `warnings[]` entry into the report below, using its `type`, `count`, `status`, `file`, and `details` verbatim. Then `Write` `posthog-ingestion-warnings-report.md` at the project root with the structure below. After the markdown lands, **delete** `.posthog-ingestion-warnings.json`.

If `source` is `"code-scan"` (warnings couldn't be read from the project), say so in the Summary: findings are derived from a code scan of known anti-patterns, not confirmed against live data. Fold any `notes[]` into the Summary too (e.g. the offending sender wasn't found in this checkout).

## Report template

<wizard-report>
# PostHog Ingestion Warnings Report

## Summary

[1–2 sentences: how warnings were determined (queried `system.ingestion_warnings` over the last 7 days, or code-scan fallback), how many distinct types were firing, and how many you fixed vs. left for manual attention. Surface any `notes`.]

**Counts**

- **Fixed**: [N]
- **Partial**: [N]
- **Needs manual attention**: [N]
- **Producing code not found**: [N]

## Fixed

For each entry with `status: "fixed"` or `"partial"`, one row:

| Warning type | Volume | What was wrong | Fix applied | File |
|---|---|---|---|---|
| `<type>` | [count] | [one-line cause] | [one-line fix] | [path:line] |

If none, write `_No fixes applied._`

## Needs manual attention

For each entry with `status: "needs-manual"` or `"not-found"`, three sentences:

1. **What's firing** — the warning and its volume.
2. **Why it matters** — the data-quality consequence (dropped events, mis-merged people, broken heatmaps, skewed timestamps, hidden future-dated events).
3. **What to do** — the concrete next step, with `file:line` if known, or where to look (e.g. a backend repo that sends events). End with the docs link.

Format:

1. **`<type>`** ([count] in 7 days) — [what's firing]. _Why it matters:_ [consequence]. _Next:_ [action]. See https://posthog.com/docs/data/ingestion-warnings

If none, write `_Nothing left to do — every firing warning was fixed._`

## About this report

This report was produced by the PostHog `ingestion-warnings` skill. Ingestion warnings mean events were dropped, mis-merged, or degraded on the way in, so the affected data can't be recovered by reprocessing — the fix is always in the code that sends the events. The skill read the warnings actually firing for this project and changed only the instrumentation tied to them.

Re-run `npx @posthog/wizard@latest ingestion-warnings` after deploying these fixes to confirm the warnings stop. They are sampled, so a small residual count can persist briefly after a fix ships.
</wizard-report>

After the report is written and the scratch file deleted, emit a final line so the wizard can surface the path:

```
Created ingestion warnings report: <absolute path to posthog-ingestion-warnings-report.md>
```
