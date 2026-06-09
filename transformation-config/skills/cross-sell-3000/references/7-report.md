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

## How to produce it

The per-item sub-sections are read-only and independent, so fan them out and collapse the results.

### a. Draft per-item sub-sections in parallel

Dispatch **one `Agent` subagent per `verified`, `propose-only`, and `failed` item, all in a single message**. These render already-decided plan data — and, for scaffolded items, the actual on-disk code — into markdown, which is formatting, not judgment, so run them on `subagent_type: "Explore"` / `model: "haiku"`. Each subagent reads **only its own item's files and `plan`/`notes`** (do not explore the wider tree) and returns the markdown for exactly its one sub-section, matching the spec under **Report structure** for its status:

- `verified` → a `## Scaffolded` sub-section
- `propose-only` → a `## Proposed (not scaffolded)` sub-section
- `failed` → a `## Needs attention` sub-section

Run no other tool between dispatch and collection, and wait for all to return before assembling.

### b. Assemble and write

You (the orchestrator) write the aggregate sections yourself from the plan in memory — `## Summary`, `## Opportunity overview`, `## Next steps` — since each needs the whole result set at once. Then collapse the returned sub-sections under their headings in plan order (`## Scaffolded`, then `## Proposed (not scaffolded)`, then `## Needs attention` — omit any heading with no items), and write the whole report to `posthog-cross-sell-report.md` in one pass.

## Report structure

**Keep the whole report short** — it rides alongside the diff, it doesn't replace reading it. Aim for under a page: terse sub-sections, no long code blocks, one line per item wherever possible. Each scaffolded product is a single illustrative example, so the report points at it and tells the operator to replicate — it does not re-explain the code.

### `## Summary`

Two sentences: how many products fit, and that one illustrative example was scaffolded per viable product (the rest are proposals). Then a one-line count — scaffolded / proposed / failed — and **no git commit was made; review the diff and commit**.

### `## Opportunity overview`

One table, ordered by `fit` then `effort`: Product · Mode · Fit · Effort · Status · one-line value.

### `## Scaffolded` (verified items)

**One line per `verified` item**: **product** — what the example changes, at `path:line` (+ any PostHog package added) — then a short **Finish in PostHog** clause naming the one manual step to activate it. No code blocks; the diff shows the code.

### `## Proposed (not scaffolded)`

**One line per `propose-only` item**: **product** — the value in a phrase, and why it wasn't scaffolded (`skip_reason`). For `cross-sell` items, name the competitor it would consolidate.

### `## Needs attention` (failed items)

Only if any item is `failed`: one line each — what was attempted, why it failed (`notes`), whether anything was reverted.

### `## Next steps`

A short list: review the diff and commit; for each scaffolded product, do its **Finish in PostHog** step and replicate the example at the other sites; pick up the proposals when ready; re-run the skill to surface the next layer.

## Cleanup

After the report is written, delete the intermediates in **one** `Bash` call:

```
rm -f /tmp/posthog-cross-sell-opportunities.json /tmp/posthog-cross-sell-plan.json /tmp/posthog-cross-sell-env.json
```

Finish by emitting:

```
[STATUS] Cross-sell complete: <N> scaffolded, <M> proposed
```
