---
title: Confirm <competitor_name> presence and install the guide skill
next_step: 2-install-sdk.md
---

# Step 1 — Confirm `<competitor_name>` presence and install the guide skill

> Discovery + skill install only. Do not modify project source files in this step.

## Status

Emit:

```
[STATUS] Scanning project for <competitor_name> calls
[STATUS] Installing migration-source-<competitor_id> guide skill
```

## Procedure

### a. Confirm `<competitor_name>` is in the project

Run the `Grep` tool against the install directory for `<competitor_name>` (case-insensitive). A non-empty result means the migration is applicable; continue. An empty result means there's nothing to migrate — emit `[ABORT] No <competitor_name> calls found` and stop. The wizard catches `[ABORT]` and terminates the run.

The migration guide at `<competitor_docs>` documents the full set of API names and patterns the agent should grep for; if the initial pass against `<competitor_name>` finds nothing, do **not** invent alternative patterns. Trust the abort.

### b. Record the target

Write `["<competitor_id>"]` to `.selected-targets.txt` at the project root. Downstream steps read this file as a fixed convention; the array shape is preserved even though there's only one entry.

### c. Install the matching migration-source skill

Call the wizard MCP tool `mcp__wizard-tools__install_skill`:

```
mcp__wizard-tools__install_skill({ skillId: "migration-source-<competitor_id>" })
```

This lands the migration guide skill at `.claude/skills/migration-source-<competitor_id>/`. The reference markdown inside is the canonical replacement guide for `<competitor_name>` — Step 4 reads it. **Do not** read the migration guide content yet; that's Step 4's job.

If `install_skill` returns an error, emit `[ABORT] Could not install migration guide skill: migration-source-<competitor_id>` and stop.

Emit `[STATUS] Wrote .selected-targets.txt` once the file is written and the guide skill is installed, then continue to the next step.
