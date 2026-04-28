# Step 9 — Resolve capture / flags / errors / replay / experiments checks

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

The Phase 3 entries are already seeded in `.posthog-audit-checks.json` from Step 8, with ids of the form `<file-stem>:<line>` pointing back into the best-practices skill. This step is pure scan + resolve — no new entries are added.

## Action

Group the seeded entries by their `area` value. The `area` strings come straight from the seed step (one per best-practices file), so let the seeded data drive the order — don't impose a hardcoded list.

For each area:

1. The relevant best-practices file is already in your context from Step 8 — do not re-read it.
2. Run targeted Greps for that area's call patterns (e.g. capture calls, feature-flag helpers, exception handlers, replay config, experiment helpers — pick patterns from what the rules in that file actually reference).
3. Read the call-site files.
4. For each seeded entry in that area, parse its `id` (file stem before `:`, line number after), look up the rule, and evaluate it against the gathered evidence. Update the entry's `status` (+ `file` / `details`) in `.posthog-audit-checks.json`.

Update `.posthog-audit-checks.json` after finishing each area.

If an area's product is not used by the project (e.g. no feature-flag calls anywhere), resolve every entry in that area to `pass` with `details: "not applicable"` — do not delete entries.

## TodoWrite

When you enter a new `area` group, update the in-progress task's `activeForm` to a short gerund derived from the area name (e.g. `area: "Feature Flags"` → `activeForm: "Auditing feature flag usage"`; `area: "Session Replay"` → `activeForm: "Auditing session replay"`).

After the final ledger Write of this step, mark `Audit capture calls, feature flags, and error tracking` as `completed` and `Generate audit report` as `in_progress` with `activeForm: "Writing audit report"`.

## Scanning guidance

Run **one** scan per area — a single Grep with the right patterns, then Read the matching files once. Evaluate every seeded entry in that area against the gathered evidence; do not re-grep for the same pattern within an area.

## Status

- Scanning capture calls against product-analytics rules
- Scanning feature-flag usage (if applicable)
- Scanning error-tracking config (if applicable)
- Scanning session replay config (if applicable)
- Scanning experiments (if applicable)
- Found [N] usage issues ([X] errors, [Y] warnings, [Z] suggestions)

---

**Upon completion, continue with:** [10-report.md](10-report.md)
