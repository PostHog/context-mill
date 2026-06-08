---
next_step: 7-report.md
---

# Step 6: Verify the scaffolds

This step confirms the edits from Step 5 landed and that the project still passes its own checks, promoting items from `scaffolded` to `verified` (or demoting to `failed`). It does NOT write the report (Step 7) and makes at most **one** repair pass. The plan is at `/tmp/posthog-cross-sell-plan.json`; the baseline is at `/tmp/posthog-cross-sell-env.json`.

## Status

Emit:

```
[STATUS] Verifying scaffolds
[STATUS] Re-running project checks
```

## Action

### a. Mechanical spot-checks

For each `scaffolded` item, confirm with one targeted `Grep` or `Read` that the integration is present: the expected PostHog API call exists at the named surface, a new file exists, an init block gained the expected key, an added package is in the manifest. Promote to `verified` on success; demote to `failed` (with `notes`) when the edit is missing or wrong.

### b. Re-run the project check

If the env file's `verify_cmd` is set, run it once from `project_root` and compare against the baseline:

- **Baseline passed, now passes** — done.
- **Baseline passed, now fails** — the failures are regressions from scaffolding. Identify which edited file each error points at, make **one** repair pass fixing obvious fallout (a missing import for the PostHog symbol, a type mismatch on a flag default, a stray comma), and re-run once. If it still fails, revert the offending item's edits (restore the original code; remove any new file and manifest entry it added) and mark that item `failed` with `notes: "reverted — broke <check>"`.
- **Baseline already failed** — only confirm no **new** errors reference files this step edited; pre-existing failures are not yours to fix.

### c. Update the plan

Write the plan back in full with every item at a final status: `verified`, `failed`, or `propose-only`.

## Output

No item remains at `scaffolded` or `planned`. Finish by emitting:

```
[STATUS] Verified: <N> of <M> scaffolds
```
