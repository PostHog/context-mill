# Step 8 — Seed capture / flags / errors / replay / experiments checks

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly two actions:

1. `Read` the **PostHog best practices** skill's `description.md` to find every reference file it ships, then `Read` each one (one Read per file, no re-reads). Skip the file already read in Step 6.
2. `Write` `.posthog-audit-checks.json` with one `pending` entry per rule, derived from those files.

**No project Grep, Read, Glob, or Bash for code is allowed in this step** — pending entries are seeded blind from the rules files. Resolution happens in Step 9.

## TodoWrite

Update the in-progress task's `activeForm` to `Seeding capture checks`. Status and content stay the same.

## Action

For every rule listed in those files, append a pending entry to `.posthog-audit-checks.json`:

- `id` — `<file-stem>:<line-number>` of the rule (e.g. `feature-flags:14`). This makes each entry traceable back to its source.
- `area` — a short Title-Case label that names the file's PostHog product. Read it off the file's title or top heading — do not invent areas the file doesn't cover. Reuse the same `area` string for all rules from the same file.
- `label` — a short, plain-English restatement of the rule (≤ 60 chars).
- `status` — `"pending"`.

Skip rules from the file already seeded in Step 6 that concern user identity — those entries already exist.

Carry forward all earlier resolved entries unchanged.

When in doubt, include the entry — Step 9 will resolve N/A entries (e.g. flag rules on a project with no flags) to `pass` with `details: "not applicable"`.

## Status

- Reading capture / flags / errors / replay / experiments rules from best-practices
- Seeding capture checks

---

**Upon completion, continue with:** [9-capture.md](9-capture.md)
