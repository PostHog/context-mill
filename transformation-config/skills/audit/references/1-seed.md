# Step 1 — Seed the ledger

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly two actions:

1. Open the TodoWrite list.
2. Seed the audit ledger via `mcp__wizard-tools__audit_seed_checks`.

No `Read`, `Glob`, `Grep`, or `Bash` against the project before the seed call.

## TodoWrite

This is the **first** TodoWrite of the run. Call `TodoWrite` with `todos` set to the **array** below (not a string — pass the literal array value):

```
todos: [
  { content: "Setup",  status: "in_progress", activeForm: "Setting up audit" },
  { content: "Audit",  status: "pending",     activeForm: "Running audit" },
  { content: "Report", status: "pending",     activeForm: "Writing report" }
]
```

## Status

Emit:

```
[STATUS] Seeding audit checklist
```

## Action

Call `mcp__wizard-tools__audit_seed_checks` with this exact `checks` payload:

```json
[
  { "id": "sdk-installed",                 "area": "Installation",   "label": "PostHog SDK installed",                          "status": "pending" },
  { "id": "sdk-up-to-date",                "area": "Installation",   "label": "SDK version up to date",                         "status": "pending" },
  { "id": "init-correct",                  "area": "Installation",   "label": "Initialization is correct",                      "status": "pending" },
  { "id": "identify-stable-distinct-id",   "area": "Identification", "label": "Stable distinct_id (not session UUID)",          "status": "pending" },
  { "id": "identify-not-late",             "area": "Identification", "label": "identify() called before captures / flag evals", "status": "pending" },
  { "id": "cross-runtime-distinct-id",     "area": "Identification", "label": "Same distinct_id across client and server",      "status": "pending" },
  { "id": "capture-event-names-static",    "area": "Event Capture",  "label": "Event names are static strings",                 "status": "pending" },
  { "id": "capture-anon-distinct-id",      "area": "Event Capture",  "label": "Truly anonymous events disable person processing", "status": "pending" },
  { "id": "capture-growth-events",         "area": "Event Capture",  "label": "Signup / activation / purchase tracked",         "status": "pending" }
]
```

This must be the **first project-touching tool call** of the run.

---

**Upon completion, continue with:** [2-version.md](2-version.md)
