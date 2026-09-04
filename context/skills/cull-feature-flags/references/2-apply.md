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

   One option per row, in ledger order:
   - `label`: `<key>`
   - `value`: `<key>`
   - `description`: `<area>, <reason from details>. <what culling does from label>.`

   For example: `Rolled out, 100% to everyone. Keeps the on path, drops the check, disables the flag.` Or: `Off for everyone, 0% everywhere, may be a rollback. Keeps the off path, drops the check, disables the flag.`

If the call errors (non-interactive host, cap reached), treat it as report-only. Do not retry more than once.

`mode` is `report-only`: nothing is approved, whatever `flags` holds. Otherwise the approved rows are exactly the `flags` answer.

Rows not approved: resolve to `status: "pass"` with `details` = seeded details plus `; declined by user`.

## Cull

### Edit the code

For each approved row, in ledger order:

1. Emit:

   ```
   [STATUS] Culling <key>
   ```

2. `Unreferenced` has no call site: skip the rest of this list, the row goes straight to the verify and disable passes. `Comment only` removes the mention only.
3. `Read` the call site named in `file` and every extra site listed in `details`.
4. Keep the winning branch recorded in `details` (`winning branch: true` keeps the code that ran when the flag was on; `false` keeps the code that ran when it was off). Delete the other branch, the flag call, and any import or hook that is now unused.
5. `Dead code`: delete the unreachable file instead of editing it.
6. `Deleted in PostHog`: code edit only, there is no flag to disable.

A failed code edit resolves the row to `status: "error"` with `details` = the seeded details plus `; failed: <one-line reason>`. That row is finished: it never reaches the disable pass, and PostHog is never touched for it.

### Verify the edited files

Once per run, after every approved row has been edited:

1. Emit `[STATUS] Type checking <n> files`.
2. `Read` `package.json` for the project's lint and typecheck scripts. Run them only on the files edited in this session, never across the whole project. Capture stdout and stderr; truncate long output to the failure region.
3. Re-run after each fix until clean. Fix only cull-induced failures, prioritizing files you edited.

A row whose file still fails resolves to `error` in the format above and never reaches the disable pass.

### Disable and resolve

For each approved row whose code edit and file verification passed, in ledger order:

1. `Deleted in PostHog` has no flag, and `Archived in PostHog` and `Disabled in PostHog` are already off: these rows need no PostHog call, go straight to step 5.
2. `exec({ "command": "search feature-flag" })`, pick the tool whose description says it disables a flag.
3. `exec({ "command": "info <tool_name>" })`, then run `exec({ "command": "call <tool_name> <json> })` with the flag key or id from `details`.
4. Never call a delete or archive tool.
5. Resolve the row: `status: "pass"`, `details` = seeded details plus `; culled`. Anything that failed in this pass resolves to `error` in the format above instead.

## Output

Every `warning` row outside `Many call sites` is now `pass` or `error`. `Read` the ledger once more and count from it, not from memory: culled = rows whose `details` end with `; culled`, failed = rows with `status: "error"`, left for you = rows whose `details` end with `; declined by user`. Emit:

```
[STATUS] Culled <a> flags, <f> failed, <d> left for you
```
