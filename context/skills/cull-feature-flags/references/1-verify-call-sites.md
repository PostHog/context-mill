---
next_step: 2-apply.md
---

# Step 1: Verify each proposed row at its call site

This step turns every `pending` ledger row into `warning` (verified, will be proposed) or `pass` (keep, with a reason). It does NOT ask the user anything and does NOT edit code or PostHog; that belongs to step 2.

## Status

Emit at the start:

```
[STATUS] Reading the flag cull ledger
```

## Read the ledger

`Read` `.posthog-audit-checks.json` at the project root.

- File missing: emit `[ABORT] No flag cull ledger found` and stop.
- Zero rows: emit `[ABORT] No PostHog feature flag usage found` and stop.

Rows with `status: pass` were seeded healthy. Leave them alone for the whole run.

## Verify the pending rows

Emit:

```
[STATUS] Verifying <n> flag call sites
```

For each `pending` row, in ledger order, emit `[STATUS] Verifying <key>` and `Read` the file named in `file` (and every other call site listed in `details`) around the given line. Decide one of:

| bucket (`area`) | confirm as `warning` when | downgrade to `pass` when |
|---|---|---|
| `Rolled out` | the call site is a boolean check whose true branch is the current behaviour | the flag gates something that must stay switchable (kill switch, ops toggle named as such) |
| `Never enabled` | the call site is a boolean check whose false branch is the current behaviour | the feature is clearly mid-build (recent scaffolding, TODOs pointing at it) |
| `Archived in PostHog`, `Disabled in PostHog` | the call site is a boolean check; keep the false branch | never, these are always safe to propose |
| `Deleted in PostHog` | no live flag in PostHog resembles the key | the key looks like a typo of a healthy flag key in the ledger (note the match in `details`) |
| `Unreferenced`, `Comment only` | the prompt says no bulk evaluation and no dynamic keys | the prompt reports `getAllFlags` or dynamic keys and the bulk or dynamic call site could reach this key |
| `Dead code` | nothing imports the file (the wizard checked; confirm with one `Grep` for the module's basename) | something imports it after all |
| `Many call sites` | always `warning`, it is a suggestion, not a removal | never |

**Truncated scan.** When the Scan facts say the scan was truncated, `Unreferenced` and `Comment only` are unproven: the wizard stopped before reading every file. Downgrade those rows to `pass` with `; kept: scan truncated, not proven unreferenced` so they land in the report's Kept table with that reason. Do not Grep for the key; the rule against grepping for flags holds.

Resolve each row through `mcp__wizard-tools__audit_resolve_checks` as soon as it is decided (one call per row, so the run screen moves while you work):

- confirmed: `status: "warning"`, `details` = the seeded details plus `; winning branch: true|false|n/a`
- downgraded: `status: "pass"`, `details` = the seeded details plus `; kept: <one-line reason>`

## Output

Every row that was `pending` is now `warning` or `pass`. No other file changed. Emit:

```
[STATUS] <w> flags proposed, <k> kept
```
