# Step 6 — Seed identification checks

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly two actions:

1. `Read` the **PostHog best practices** skill's `description.md` to find which reference file covers identification (look for the file describing `identify()` / `distinct_id` / `reset()` / `group()` rules), then `Read` that file. It is the source of truth for identification rules — do not invent rules that aren't there.
2. `Write` `.posthog-audit-checks.json` with one `pending` entry per identification-relevant rule, derived from that file.

**No project Grep, Read, Glob, or Bash for code is allowed in this step** — pending entries are seeded blind from the rules file. Resolution happens in Step 7.

## TodoWrite

Update the in-progress task's `activeForm` to `Seeding identification checks`. Status and content stay the same.

## Action

For every rule in the identification reference file that concerns user identity (`identify()` / `distinct_id` / `reset()` / `group()` / cross-runtime identity), append a pending entry to `.posthog-audit-checks.json`:

- `id` — `<file-stem>:<line-number>` of the rule, where `<file-stem>` is the basename of the reference file you read (so the entry is traceable back to its source).
- `area` — `"Identification"`.
- `label` — a short, plain-English restatement of the rule (≤ 60 chars; e.g. `Stable distinct_id used in identify()`).
- `status` — `"pending"`.

Carry forward all earlier resolved entries unchanged.

When in doubt, include the entry — Step 7 will resolve N/A entries to `pass` with `details: "not applicable"`.

## Status

- Reading identification rules from best-practices
- Seeding identification checks

---

**Upon completion, continue with:** [7-identify.md](7-identify.md)
