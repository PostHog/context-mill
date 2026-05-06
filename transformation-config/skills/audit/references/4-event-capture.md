---
next_step: 5-discoverable-dispatch.md
---

# Step 4 — Event capture

This step dispatches the **event-capture specialist** as a single `Task` and waits for it to fully resolve all three event-capture checks before continuing.

The specialist owns its own internal fan-out (3 nested rule subagents in parallel). Each rule subagent emits one `audit_resolve_checks` call for its single check id:

- `capture-event-names-static`
- `capture-uses-proxy`
- `capture-growth-events`

The ledger's mutex serializes concurrent writes — there's no race.

## Status

Emit before dispatching:

```
[STATUS] Auditing event capture
```

## Action — dispatch the event-capture specialist

Make **one `Task` tool call** to `audit-subagents-event-capture`:

`description`: `Audit event capture`

`prompt`:
```
Follow the skill at `.claude/skills/audit-subagents-event-capture/SKILL.md`. Run all of its checks against the user's project. Resolve each check via `mcp__wizard-tools__audit_resolve_checks` as you finish it. Do not write files. Return a one-line summary when done.
```

Wait for it to return before continuing to Step 5. Do not run any other tools between dispatch and the next step.

## Selection overrides

If the wizard's prompt contains a "Specialist selection (override defaults):" block listing event-capture as suppressed, do **not** dispatch the specialist. Instead, emit one `mcp__wizard-tools__audit_resolve_checks` call patching all three event-capture check ids with `{ status: "warning", details: "skipped: suppressed by --skip" }`, then continue to Step 5.
