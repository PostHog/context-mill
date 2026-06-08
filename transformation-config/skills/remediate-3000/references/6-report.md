---
next_step: null
---

# Step 6: Write the remediation report and clean up

The plan at `/tmp/posthog-remediation-plan.json` now has a final status on every item. This step renders it into exactly one new file at the project root — `posthog-remediation-report.md` — and deletes the `/tmp/` intermediates. Do not re-read earlier step files.

## Status

Emit:

```
[STATUS] Writing remediation report
```

## File-creation contract

The **only** file this step creates is `posthog-remediation-report.md` at the project root. Do NOT create `posthog-remediation-summary.md`, sidecar JSON/CSV exports, or any other file. Do NOT edit `posthog-audit-report.md`.

One exception: the wizard's outer prompt asks for a brief summary file after the skill workflow completes (e.g. `./posthog-remediate-3000-report.md`). That file is owned by the wizard, not this skill — when asked, write a short summary there that links to `posthog-remediation-report.md` for the full detail. Do not duplicate the full report into it.

## Report structure

### `## Summary`

One paragraph: what was remediated and the overall outcome. Then a counts line: verified / failed / posthog-side / skipped, and a note that **no git commit was made** — the operator reviews the diff and commits.

### `## Changes applied`

One sub-section per `verified` item: area · check, severity badge, files edited as `path:line`, and a 2–4 sentence description of what changed. Where the change is short, show a before/after fenced snippet read from the edited file (the **actual** new code, not the audit's proposal).

### `## Needs manual attention`

One sub-section per `failed` item: what was attempted, why it failed (the `notes` field), whether anything was reverted, and what the operator should do by hand — including the original recommendation from the plan so the report stands alone.

### `## PostHog-side actions`

For each `posthog-side` item, render a fenced **copy-paste prompt** the operator can paste into any PostHog MCP-enabled chat. Each prompt must (1) name the exact PostHog artifacts involved (insight names, flag keys), (2) instruct the assistant to re-verify current state before mutating anything, and (3) describe the change in one sentence. Example shape:

```
Using the PostHog MCP tools: find the insights that reference the event
"<old name>". Verify each still references it, then update them to
reference "<new name>" instead. List every insight you changed.
```

### `## Skipped`

A table of `skipped` items: check, severity, reason. Greenfield adoption items get one sentence pointing at the relevant PostHog product docs.

### `## Next steps`

Tell the operator to: review the working-tree diff and commit; run the PostHog-side prompts; and re-run the audit (`posthog-wizard` with the `audit-3000` skill) to refresh the ledger and confirm the findings are resolved.

## Cleanup

After the report is written, delete the intermediates in **one** `Bash` call:

```
rm -f /tmp/posthog-remediation-plan.json /tmp/posthog-remediation-env.json
```

Finish by emitting:

```
[STATUS] Remediation complete: <N> fixed, <M> need manual follow-up
```
