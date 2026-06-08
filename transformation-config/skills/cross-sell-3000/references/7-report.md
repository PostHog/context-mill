---
next_step: null
---

# Step 7: Write the cross-sell report and clean up

The plan at `/tmp/posthog-cross-sell-plan.json` now has a final status on every item. This step renders it into exactly one new file at the project root — `posthog-cross-sell-report.md` — and deletes the `/tmp/` intermediates. Do not re-read earlier step files.

## Status

Emit:

```
[STATUS] Writing cross-sell report
```

## File-creation contract

The **only** file this step creates is `posthog-cross-sell-report.md` at the project root. Do NOT create a separate summary file, sidecar JSON/CSV, or example/demo source files.

One exception: the wizard's outer prompt asks for a brief summary file after the skill workflow completes (e.g. `./posthog-cross-sell-3000-report.md`). That file is owned by the wizard, not this skill — when asked, write a short summary there that links to `posthog-cross-sell-report.md` for the full detail. Do not duplicate the full report into it.

## Report structure

### `## Summary`

One paragraph: how many PostHog products were found to fit, how many were scaffolded vs proposed, and the headline opportunity. Then a counts line: verified / failed / proposal-only, and a note that **no git commit was made** — the operator reviews the diff and commits.

### `## Opportunity overview`

A table of every item, ordered by `fit` then `effort`: Product · Mode (cross-sell / greenfield / gap) · Fit · Effort · Status · one-line value. This is the at-a-glance proposal.

### `## Scaffolded` (verified items)

One sub-section per `verified` item: product, the `value` pitch, files touched as `path:line`, any PostHog package added, and a short before/after fenced snippet read from the **actual** scaffolded code. End each with a **Finish in PostHog** line naming the one manual step to activate it (create the flag, build the survey, set the event live), and a **Verify** line on how the operator can see it working.

### `## Proposed (not scaffolded)`

One sub-section per `propose-only` item: product, the `value` pitch, why it wasn't scaffolded (`skip_reason`), and a concrete **implementation plan** the operator can follow by hand or hand to a coding agent — derived from the item's `plan` block if present, else from the evidence and recommendation. For `cross-sell` items, frame the consolidation win against the named competitor.

### `## Needs attention` (failed items)

Only if any item is `failed`: what was attempted, why it failed (`notes`), whether anything was reverted, and what to do by hand.

### `## Next steps`

Tell the operator to: review the working-tree diff and commit; complete each scaffolded product's **Finish in PostHog** step; pick up the proposal-only plans when ready; and re-run this skill after adopting products to surface the next layer of opportunities.

## Cleanup

After the report is written, delete the intermediates in **one** `Bash` call:

```
rm -f /tmp/posthog-cross-sell-opportunities.json /tmp/posthog-cross-sell-plan.json /tmp/posthog-cross-sell-env.json
```

Finish by emitting:

```
[STATUS] Cross-sell complete: <N> scaffolded, <M> proposed
```
