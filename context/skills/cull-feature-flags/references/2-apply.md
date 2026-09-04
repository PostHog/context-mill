---
next_step: 3-report.md
---

# Step 2: Ask once, then cull the approved rows

This step asks the user which `warning` rows to apply, then applies them: code edit first, PostHog disable second. It does NOT write the report; that belongs to step 3. Step 1 already decided the winning branch for every row; do not re-verify.

## Ask

Emit:

```
[STATUS] Waiting for confirmation
```

`Read` `.posthog-audit-checks.json`. Collect every row with `status: "warning"` whose `area` is not `Many call sites` (that bucket is report-only).

Zero such rows: skip to the Output section, nothing to apply.

Call `mcp__wizard-tools__wizard_ask` exactly once, with two questions in that one call so the report-only choice stands on its own instead of hiding in the flag list:

1. `id: "mode"`, `kind: "single"`, prompt verbatim:

   > Nothing has been changed yet. Do you want to cull flags now, or just get the report?

   Options, in this order:
   - label `Report only, change nothing`, value `report-only`
   - label `Cull the flags I pick below`, value `cull`

2. `id: "flags"`, `kind: "multi"`, prompt verbatim:

   > Pick the flags to cull. Each one gets disabled in PostHog (re-enable any time from the flag page) and its check removed from code (revert with git).

   One option per row: label `[<area>] <key>: <proposed action from label>`, value `<key>`.

If the call errors (non-interactive host, cap reached), treat it as report-only. Do not retry more than once.

`mode` is `report-only`: nothing is approved, whatever `flags` holds. Otherwise the approved rows are exactly the `flags` answer.

Rows not approved: resolve to `status: "pass"` with `details` = seeded details plus `; declined by user`.

## Cull

Emit per row:

```
[STATUS] Culling <key>
```

For each approved row, in ledger order:

1. **Code edit** (skip for `Unreferenced`; for `Comment only` remove the mention only):
   - `Read` each call site listed in `details`.
   - Keep the winning branch recorded in `details` (`winning branch: true` keeps the code that ran when the flag was on; `false` keeps the code that ran when it was off). Delete the other branch, the flag call, and any import or hook that is now unused.
   - `Dead code`: delete the unreachable file instead of editing it.
   - `Deleted in PostHog`: code edit only, there is no flag to disable.
   - Re-`Read` the edited file once to confirm it still parses by eye (balanced braces, no dangling variable).
2. **Disable the flag in PostHog** (skip for `Deleted in PostHog`, there is no flag, and for `Archived in PostHog` and `Disabled in PostHog`, the flag is already off; only after step 1 succeeded for this row):
   - `exec({ "command": "search feature-flag" })`, pick the tool whose description says it disables a flag.
   - `exec({ "command": "info <tool_name>" })`, then `exec({ "command": "call <tool_name> <json> })` with the flag key or id from `details`.
   - Never call a delete or archive tool.
3. Resolve the row:
   - both parts succeeded: `status: "pass"`, `details` = seeded details plus `; culled`
   - anything failed: `status: "error"`, `details` = seeded details plus `; failed: <one-line reason>`. If the code edit failed, do not touch PostHog for this row.

## Output

Every `warning` row outside `Many call sites` is now `pass` or `error`. `Read` the ledger once more and count from it, not from memory: culled = rows whose `details` end with `; culled`, failed = rows with `status: "error"`, left for you = rows whose `details` end with `; declined by user`. Emit:

```
[STATUS] Culled <a> flags, <f> failed, <d> left for you
```
