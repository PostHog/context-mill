---
title: Confirm <competitor_name> presence
next_step: 2-install-sdk.md
---

# Step 1 — Confirm `<competitor_name>` presence

> Discovery only. Do not modify project source files in this step.

## Status

Emit:

```
[STATUS] Scanning project for <competitor_name> calls
```

## Procedure

### a. Confirm `<competitor_name>` is in the project

Run the `Grep` tool against the install directory for `<competitor_name>` (case-insensitive). A non-empty result means the migration is applicable; continue. An empty result means there's nothing to migrate — emit `[ABORT] No <competitor_name> calls found` and stop. The wizard catches `[ABORT]` and terminates the run.

The migration docs in this skill's `references/` directory document the full set of API names and patterns the agent should grep for; if the initial pass against `<competitor_name>` finds nothing, do **not** invent alternative patterns. Trust the abort.

### b. Record the target

Write `["<competitor_id>"]` to `.selected-targets.txt` at the project root. Downstream steps read this file as a fixed convention; the array shape is preserved even though there's only one entry.

Emit `[STATUS] Wrote .selected-targets.txt` once the file is written, then continue to the next step.
