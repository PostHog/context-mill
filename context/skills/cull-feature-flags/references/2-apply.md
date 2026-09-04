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

Zero such rows: do not call `wizard_ask`; skip to the Output section, nothing to apply.

Call `mcp__wizard-tools__wizard_ask` exactly once. Build its questions in this order. Include a `multi` question only when its listed areas contain at least one collected row.

1. For `Rolled out`, use `id: "rolled-out"`, `kind: "multi"`, and `required: false`. Prompt:

   > Pick rolled-out flags to cull. These flags are at 100% for everyone with no conditions, so the code only ever runs the "on" branch. Culling keeps that branch, drops the check, and disables the flag in PostHog. Re-enable it with one toggle; rollout conditions are kept.

   Example description: `100% to everyone with no conditions; keeps the code that runs today; src/checkout.ts:42, src/cart.ts:18; disables the flag`.

2. For `Off for everyone`, use `id: "off-for-everyone"`, `kind: "multi"`, and `required: false`. Prompt:

   > Pick flags that are off for everyone to cull. These flags are at 0% for everyone. A flag rolled back after an incident looks exactly like one that never shipped, so a 0% flag may be a rollback lever. Keeping it costs nothing. Culling keeps the "off" branch, drops the check, and disables the flag.

   Example description: `0% to everyone after the checkout rollback; keeps the off branch; src/checkout.ts:42; disables the flag`.

3. For `Archived in PostHog`, `Disabled in PostHog`, and `Deleted in PostHog`, use `id: "off-in-posthog"`, `kind: "multi"`, and `required: false`. Prompt:

   > Pick flags that are already off or absent in PostHog to cull. PostHog already turned these off or no longer has them, but the code still checks them. Culling keeps the "off" branch and drops the check. Nothing changes in PostHog for these flags.

   Example description: `disabled in PostHog; keeps the off branch; src/search.ts:27; no PostHog change`.

4. For `Unreferenced`, `Comment only`, and `Dead code`, use `id: "not-in-code"`, `kind: "multi"`, and `required: false`. Prompt:

   > Pick flags not evaluated in this repository to cull. PostHog has these flags, but nothing in this repository evaluates them. Only this repository was scanned, so a flag read by another service, a mobile app, or a bulk fetch elsewhere will look unreferenced here. Culling disables the flag and removes the comment or deletes the dead module when present.

   Example description: `the only evaluation is in an unreachable module; deletes the module; src/legacy-checkout.ts:1; disables the flag`.

5. Always include `id: "mode"`, `kind: "single"`, last. Prompt verbatim:

   > Cull the flags you picked, or report only and change nothing?

   Options, in this order:
   - label `Report only, change nothing`, value `report-only`
   - label `Cull the flags I picked`, value `cull`

For every `multi` question, keep rows in ledger order and do not preselect an option. Build every option as follows:

- `label`: the flag key.
- `value`: the flag key.
- `description`: one line containing, in order, the seeded rollout summary clause from `details`; the code outcome; every call site as `path:line`, starting with `file` and then each `also <path:line>` entry from `details`; and the PostHog outcome.

Translate `winning branch: true` to `keeps the code that runs today` and `winning branch: false` to `keeps the off branch`. Use `removes the mention` for `Comment only` and `deletes the module` for `Dead code`. Omit the code outcome for `Unreferenced`. Use `disables the flag` for `Rolled out`, `Off for everyone`, `Unreferenced`, `Comment only`, and `Dead code`. Use `no PostHog change` for `Archived in PostHog`, `Disabled in PostHog`, and `Deleted in PostHog`. Omit any empty call-site fragment.

Approved rows are the union of the four `multi` answers only when `mode` is `cull`. Nothing is approved when `mode` is `report-only`, the union is empty, or the call errors or is cancelled with Esc. Do not retry the call.

Resolve every collected row not approved to `status: "pass"` with `details` = seeded details plus `; declined by user`.

When nothing is approved, skip the Cull section and follow the Output instructions.

## Cull

### Edit the code

For each approved row, in ledger order:

1. Emit:

   ```
   [STATUS] Culling <key>
   ```

2. `Unreferenced` has no call site: skip the rest of this list, the row goes straight to the verify and disable passes. `Comment only` removes the mention only.
3. `Read` the call site named in `file` and every extra site listed in `details`.
4. Emit `[STATUS] Editing <file>` before each file edit.
5. Keep the winning branch recorded in `details` (`winning branch: true` keeps the code that ran when the flag was on; `false` keeps the code that ran when it was off). Delete the other branch, the flag call, and any import or hook that is now unused.
6. `Dead code`: delete the unreachable file instead of editing it.
7. `Deleted in PostHog`: code edit only, there is no flag to disable.

A failed code edit resolves the row to `status: "error"` with `details` = the seeded details plus `; failed: <one-line reason>`. That row is finished: it never reaches the disable pass, and PostHog is never touched for it.

### Verify the edited files

Once per run, after every approved row has been edited:

1. Emit `[STATUS] Type checking <n> files`.
2. `Read` `package.json` for the project's lint and typecheck scripts. Run them only on the files edited in this session, never across the whole project. Capture stdout and stderr; truncate long output to the failure region.
3. Re-run after each fix until clean. Fix only cull-induced failures, prioritizing files you edited.

A row whose file still fails resolves to `error` in the format above and never reaches the disable pass.

### Disable and resolve

Before the loop below, run `exec({ "command": "search feature-flag" })` once, pick the tool whose description says it disables a flag, then run `exec({ "command": "info <tool_name>" })` once.

For each approved row whose code edit and file verification passed, in ledger order:

1. `Deleted in PostHog` has no flag, and `Archived in PostHog` and `Disabled in PostHog` are already off: these rows need no PostHog call, go straight to step 4.
2. Emit `[STATUS] Disabling <key> in PostHog`, then run only `exec({ "command": "call <tool_name> <json> })` with the flag key or id from `details`.
3. Never call a delete or archive tool.
4. Resolve the row: `status: "pass"`, `details` = seeded details plus `; culled`. Anything that failed in this pass resolves to `error` in the format above instead.

## Output

Every `warning` row outside `Many call sites` is now `pass` or `error`. `Read` the ledger once more and count from it, not from memory: culled = rows whose `details` end with `; culled`, failed = rows with `status: "error"`, left for you = rows whose `details` end with `; declined by user`. Emit:

```
[STATUS] Culled <a> flags, <f> failed, <d> left for you
```

When nothing was approved, emit this once instead and continue to the report step:

```
[STATUS] Report only, nothing changed
```
