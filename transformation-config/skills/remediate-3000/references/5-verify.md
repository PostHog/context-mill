---
next_step: 6-report.md
---

# Step 5: Verify the fixes

This step confirms the edits from steps 3–4 actually landed and that the project still passes its own checks, promoting plan items from `fixed` to `verified` (or demoting to `failed`). It does NOT write the report (step 6) and it makes at most **one** repair pass. The plan is at `/tmp/posthog-remediation-plan.json`; the baseline is at `/tmp/posthog-remediation-env.json`.

## Status

Emit:

```
[STATUS] Verifying fixes
[STATUS] Re-running project checks
```

## Action

### a. Mechanical spot-checks

For each `fixed` item, confirm with one targeted `Grep` or `Read` that the change is present: a removed property key no longer appears in that capture call, an added config key exists in the init options, a renamed event's old name is gone from source, a new `identify`/`captureException` call exists at the named surface. Promote to `verified` on success; demote to `failed` (with `notes`) when the edit is missing or wrong.

### b. Re-run the project check

If the env file's `verify_cmd` is set, run it once from `project_root` and compare against the baseline:

- **Baseline passed, now passes** — done.
- **Baseline passed, now fails** — the failures are regressions. Identify which edited file each error points at, make **one** repair pass fixing obvious edit fallout (an unused import left behind, a missing comma, a renamed symbol referenced elsewhere), and re-run the command once. If it still fails, revert the offending item's edits (restore the original code at those sites) and mark that item `failed` with `notes: "reverted — broke <check>"`.
- **Baseline already failed** — only confirm no **new** errors reference files this skill edited; pre-existing failures are not yours to fix.

### c. Update the plan

Write the plan back in full with every item at a final status: `verified`, `failed`, or `skipped`.

## Output

No item remains at `planned` or bare `fixed`. Finish by emitting:

```
[STATUS] Verified: <N> of <M> fixes
```
