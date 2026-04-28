# Step 7 — Resolve identification checks

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

The identification entries are already seeded in `.posthog-audit-checks.json` from Step 6, with ids of the form `<file-stem>:<line>` pointing back into the best-practices skill. This step is pure scan + resolve — no new entries are added.

## Action

For each seeded identification entry (i.e. every entry whose `area` is `"Identification"`), look up its source rule by parsing the `id`: the part before `:` is the best-practices file stem, the part after is the line number. Read that rule and evaluate the project against it. The best-practices file is already in your context from Step 6 — do not re-read it.

Update `.posthog-audit-checks.json` after you finish each logical group (identify / reset / group / cross-runtime) by setting each seeded entry's `status` to `pass` / `error` / `warning` / `suggestion` and adding `file` / `details` where relevant.

If a check doesn't apply to this project (e.g. the project has no logout flow, so `reset()` rules are moot), resolve the entry to `pass` with `details: "not applicable"` — do not delete entries.

## TodoWrite

Rotate the in-progress task's `activeForm` as you move through the logical groups:

- before scanning identify calls: `Scanning identify calls`
- before scanning reset/logout: `Scanning reset and logout flows`
- before scanning groups: `Scanning group calls`
- before cross-runtime checks: `Checking cross-runtime distinct_id`

After the final ledger Write of this step, mark `Audit identification logic` as `completed` and `Audit capture calls, feature flags, and error tracking` as `in_progress` with `activeForm: "Seeding capture checks"`.

## Scanning guidance

Run targeted Greps for `posthog.identify(`, `posthog.reset(`, `posthog.group(`, and the framework-specific identity helpers; Read the call-site files. The goal is one scan per logical group, then evaluate every seeded entry in that group against the gathered evidence — do not re-grep for the same pattern within a group.

## Status

- Scanning identify calls
- Scanning reset / logout flows
- Scanning group calls (if applicable)
- Checking cross-runtime distinct_id consistency
- Found [N] identification issues ([X] errors, [Y] warnings, [Z] suggestions)

---

**Upon completion, continue with:** [8-capture-seed.md](8-capture-seed.md)
