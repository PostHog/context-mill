---
next_step: 4-event-capture.md
---

# Step 3 — Identification

This step dispatches the **identification specialist** as a single `Task` and waits for it to fully resolve all four identification checks before continuing.

The specialist owns its own internal fan-out (4 nested rule subagents in parallel). Each rule subagent emits one `audit_resolve_checks` call for its single check id:

- `identify-stable-distinct-id`
- `identify-not-late`
- `cross-runtime-distinct-id`
- `identify-reset-on-logout`

The ledger's mutex serializes concurrent writes — there's no race.

## Status

Emit before dispatching:

```
[STATUS] Auditing identification
```

## Action — dispatch the identification specialist

Make **one `Task` tool call** to `audit-subagents-identification`:

`description`: `Audit identification`

`prompt`:
```
Follow the skill at `.claude/skills/audit-subagents-identification/SKILL.md`. Run all of its checks against the user's project. Resolve each check via `mcp__wizard-tools__audit_resolve_checks` as you finish it. Do not write files. Return a one-line summary when done.
```

Wait for it to return before continuing to Step 4. Do not run any other tools between dispatch and the next step.

## Selection overrides

If the wizard's prompt contains a "Specialist selection (override defaults):" block listing identification as suppressed, do **not** dispatch the specialist. Instead, emit one `mcp__wizard-tools__audit_resolve_checks` call patching all four identification check ids with `{ status: "warning", details: "skipped: suppressed by --skip" }`, then continue to Step 4.
