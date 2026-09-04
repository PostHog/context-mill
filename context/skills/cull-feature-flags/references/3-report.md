---
next_step: null
---

# Step 3: Write the cull report

The report is rendered from `.posthog-audit-checks.json`. Every row ends up in it; nothing is invented. Do not delete the ledger, the wizard owns it.

## Status

Emit:

```
[STATUS] Writing feature flag cull report
```

## Action

`Read` the ledger once. `Write` `posthog-feature-flag-cull-report.md` at the project root using the template below. Use `id`, `area`, `label`, `file`, and `details` verbatim where the template calls for them.

The report serves two readers: someone who declined everything and wants a findings list to act on by hand, and someone who culled flags and wants to see what happened. So it always opens with the full findings table, then groups rows by outcome.

Findings verdict per row comes from `area`: `Healthy` is **healthy**, `Many call sites` is **warning**, every other bucket is **stale**.

Outcome sections, reading the suffix the earlier steps appended to `details`:

1. **Culled**: `status: pass` with `; culled`
2. **Left for you**: `status: pass` with `; declined by user`, plus every `warning` row still open when `wizard_ask` was unavailable. Each row keeps its proposed action so the reader can do it by hand.
3. **Failed**: `status: error`
4. **Kept**: `status: pass` with `; kept:` plus every row the wizard seeded as healthy, and every `Many call sites` row (list those under a "Suggested wrappers" heading with the call-site count)

## Report template

<wizard-report>
# PostHog Feature Flag Cull Report

## Summary

One paragraph: how many flags the wizard looked at, how many were proposed, culled, how many of the culled had a live flag to disable, left for you, failed, kept. Whether bulk evaluation or dynamic keys limited what could be proposed.

| Outcome | Count |
|---|---|
| Culled | n |
| of which disabled in PostHog | n |
| Left for you | n |
| Failed | n |
| Kept | n |

## Findings

Every flag the wizard looked at, one row each, ledger order.

| Flag | Verdict | Bucket | Proposed action | Call sites |
|---|---|---|---|---|
| `<id>` | stale, warning, or healthy | `<area>` | `<label>` | `<file>` and the rest from `details` |

## Culled

Culled means the code check is gone where there was one. The PostHog column says what happened to the flag itself, since only a live flag gets disabled.

| Flag | Bucket | Code | PostHog | Call sites |
|---|---|---|---|---|
| `<id>` | `<area>` | `<label>` | see below | `<file>` and the rest from `details` |

PostHog column by bucket: `Rolled out`, `Off for everyone`, `Unreferenced`, `Comment only`, `Dead code` say **disabled**; `Archived in PostHog` says **already archived, untouched**; `Disabled in PostHog` says **already off, untouched**; `Deleted in PostHog` says **no flag, nothing to disable**.

## Left for you

Same table, column "What to do" instead of "What changed".

## Failed

Same table plus a "Reason" column from `details`.

## Kept

Same table plus a "Why" column from `details`.

### Suggested wrappers

For each `Many call sites` row: the flag, the number of files evaluating it directly, and one sentence recommending a single hook or helper module.

## Undo

Only present when something was culled. Everything here is reversible in one step each:

- Code: `git checkout -- <every file the wizard edited>` (run `git status` first; the tree was clean when the run started, so every change is the wizard's). List the files.
- PostHog: one line per disabled flag, `Re-enable <key>: <app host>/project/<project id>/feature_flags/<flag id>`. Read the app host and project id from the wizard prompt or the MCP project state.

## Follow-ups

- Flags disabled here are still in PostHog. Archive or delete them from the app once the deploy is out; the wizard never does either.
- Any `Failed` row needs a manual pass at the listed call sites.

## About this report

Two sentences: the wizard scanned the source tree and the project's flags with fixed rules and seeded a ledger; this skill verified each row at its call site, culled only what was confirmed, and never deleted anything.
</wizard-report>

## Output

End with exactly this line so the wizard can pick up the path:

```
Created cull report: <absolute path to posthog-feature-flag-cull-report.md>
```
