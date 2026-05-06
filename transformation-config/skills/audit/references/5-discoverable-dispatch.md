---
next_step: 6-report.md
---

# Step 5 — Dispatch agent + discoverable specialists

This step **always runs** unless the wizard injected a "Specialist selection (override defaults):" block into the runner's prompt that explicitly excludes the dispatch agent. The default behavior — including for plain `posthog-wizard audit` invocations with no flags — is to execute Action 1 + Action 2 below.

The dispatch agent (`audit-subagents-dispatch`) decides which discoverable specialists are appropriate for this project. The runner then enrolls each picked specialist's checks into the ledger via `audit_add_checks` and fans them out as Tasks. Each dispatched specialist owns its checks: it greps, evaluates, and patches the ledger via `audit_resolve_checks`.

## Status

Emit before dispatching:

```
[STATUS] Asking dispatch agent which specialists to run
```

## Action 1 — dispatch the dispatch agent

Fire one `Task` call to `audit-subagents-dispatch`.

`description`: `Audit dispatch — pick discoverable specialists`

`prompt`:

```
Follow the skill at `.claude/skills/audit-subagents-dispatch/SKILL.md`.
Decide which discoverable audit specialists should run against this project.
End your turn with a single fenced ```json``` block per the output shape documented in your skill (`{ specialist: "dispatch", schemaVersion, auditedAt, dispatch[], skipped[] }`).
You are the only specialist that returns JSON in chat — your output is a control signal the runner parses to choose what to dispatch next. Do not call `audit_resolve_checks` or `audit_add_checks`.
```

Wait for it to return. Locate the **last** fenced ```json``` block in the result and parse it. If parsing fails, treat `dispatch[]` as empty and continue.

## Action 2 — fan out the second wave

For each entry in the dispatch agent's `dispatch[]`:

1. `mcp__wizard-tools__install_skill({ skillId })`
2. `Read .claude/skills/<skillId>/checks.json` — an array of `{ id, area, label }` objects.
3. `mcp__wizard-tools__audit_add_checks(<the parsed array>)` — enrolls them in the ledger as `pending` so the wizard UI surfaces them mid-run.
4. Fire one `Task` call dispatching the specialist. Use the standard dispatch prompt (substitute `<skill-id>`):

   > Follow the skill at `.claude/skills/<skill-id>/SKILL.md`. Run all of its checks against the user's project. Resolve each check via `mcp__wizard-tools__audit_resolve_checks` as you finish it. Do not write files. Return a one-line summary when done.

Issue all four sub-steps as one batched message per specialist where the harness allows (`install_skill`, `Read`, `audit_add_checks`, `Task` together). Across specialists, the second-wave Tasks themselves can run concurrently — fire them all in one message after the per-specialist setup completes.

If `dispatch[]` is empty, skip the second-wave fan-out (no specialists to dispatch). The dispatch agent's own work in Action 1 is still required — it must run.

Wait for every spawned second-wave Task to return before continuing to Step 6. The ledger's mutex serializes concurrent writes — there is no race when multiple specialists patch the ledger at the same time.
