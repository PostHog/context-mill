---
next_step: 3-report.md
---

# Step 2: Ask once, then apply the approved rows

This step asks the user which `warning` rows to apply, then applies them: code edit first, PostHog disable second. It does NOT write the report; that belongs to step 3. Step 1 already decided the winning branch for every row; do not re-verify.

## Ask

Emit:

```
[STATUS] Waiting for confirmation
```

`Read` `.posthog-audit-checks.json`. Collect every row with `status: "warning"` whose `area` is not `multi-callsite-no-wrapper` (that bucket is report-only).

Zero such rows: skip to the Output section, nothing to apply.

Call `mcp__wizard-tools__wizard_ask` exactly once, `kind: "multi"`, one option per row plus a decline option listed first:

- decline option: label `Apply nothing, report only`, value `none`
- per row: label `[<area>] <key>: <proposed action from label>`, value `<key>`

If the call errors (non-interactive host, cap reached), treat it as decline. Do not retry more than once.

Rows the user did not pick: resolve to `status: "pass"` with `details` = seeded details plus `; declined by user`.

## Apply

Emit per row:

```
[STATUS] Applying <key>
```

For each approved row, in ledger order:

1. **Code edit** (skip for `unreferenced`; for `unreferenced-comment-only` remove the mention only):
   - `Read` each call site listed in `details`.
   - Keep the winning branch recorded in `details` (`winning branch: true` keeps the code that ran when the flag was on; `false` keeps the code that ran when it was off). Delete the other branch, the flag call, and any import or hook that is now unused.
   - `dead-code-reference`: delete the unreachable file instead of editing it.
   - `deleted-still-referenced`: code edit only, there is no flag to disable.
   - Re-`Read` the edited file once to confirm it still parses by eye (balanced braces, no dangling variable).
2. **Disable the flag in PostHog** (every bucket except `deleted-still-referenced`, and only after step 1 succeeded for this row):
   - `exec({ "command": "search feature-flag" })`, pick the tool whose description says it disables a flag.
   - `exec({ "command": "info <tool_name>" })`, then `exec({ "command": "call <tool_name> <json> })` with the flag key or id from `details`.
   - Never call a delete or archive tool.
3. Resolve the row:
   - both parts succeeded: `status: "pass"`, `details` = seeded details plus `; applied`
   - anything failed: `status: "error"`, `details` = seeded details plus `; failed: <one-line reason>`. If the code edit failed, do not touch PostHog for this row.

## Output

Every `warning` row outside `multi-callsite-no-wrapper` is now `pass` or `error`. Emit:

```
[STATUS] Applied <a> flags, <f> failed, <d> declined
```
