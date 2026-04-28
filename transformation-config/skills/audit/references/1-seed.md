# Step 1 — Seed the ledger

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly one action: open `.posthog-audit-checks.json` at the project root with the seeded installation entries.

## TodoWrite

This is the **first** TodoWrite of the run. Open the four-item list with these `content` strings verbatim, with the first task `in_progress` and the others `pending`:

```
[
  { "content": "Audit installation & setup",                          "status": "in_progress", "activeForm": "Seeding audit checklist" },
  { "content": "Audit identification logic",                          "status": "pending",     "activeForm": "Auditing identification logic" },
  { "content": "Audit capture calls, feature flags, and error tracking", "status": "pending",  "activeForm": "Auditing capture calls" },
  { "content": "Generate audit report",                               "status": "pending",     "activeForm": "Writing audit report" }
]
```

## Action

`Write` the following to `.posthog-audit-checks.json`:

```json
[
  { "id": "sdk-installed",  "area": "Installation", "label": "PostHog SDK installed",     "status": "pending" },
  { "id": "sdk-up-to-date", "area": "Installation", "label": "SDK version up to date",    "status": "pending" },
  { "id": "init-correct",   "area": "Installation", "label": "Initialization is correct", "status": "pending" }
]
```

This must be the **first project-touching tool call** of the run. No `Read`, `Glob`, `Grep`, or `Bash` against the project before this `Write`.

## Status

Status to report in this phase:

- Seeding installation checks

---

**Upon completion, continue with:** [2-manifests.md](2-manifests.md)
