# PostHog Cross-Sell 3000

This skill grows a project's PostHog footprint **from the code outward**. It scans the codebase to see which PostHog products would fit — products the team isn't using yet, competitor tools PostHog could replace, and surfaces where an in-use product is missing coverage — then **proposes** the strongest opportunities, **plans** the implementation for each, and **scaffolds** working code for the ones that are viable today. It reads the code, not a CRM: every proposal is grounded in `file:line` evidence from the repository, never external sales data.

The flow is three connected jobs: **propose** (which products fit and why) → **plan** (the concrete implementation for each viable one) → **scaffold** (apply a minimal, build-verified integration). Opportunities that need a product decision or a missing dependency before code can land (e.g. a brand-new logging backend, surveys that are configured in the PostHog UI) are kept as **proposal + plan only**, not scaffolded.

**Write contract.** This skill edits project source — scaffolding is its job — but it only edits files named by a plan item (or files the item's plan explicitly describes), it never runs `git commit`, `git push`, or any other git mutation, it never mutates PostHog state through MCP, and the only new dependencies it may add are official PostHog packages. It creates exactly **one** new file at the project root: `posthog-cross-sell-report.md`. Intermediate state lives in `/tmp/` while the chain runs (`/tmp/posthog-cross-sell-opportunities.json`, `/tmp/posthog-cross-sell-plan.json`, `/tmp/posthog-cross-sell-env.json`) and the final step deletes all three. The operator reviews the diff and commits — not this skill.

## Workflow

The cross-sell run is a step chain. **The exact step list lives in the reference files themselves, not in this overview.** Step 1 lives at `references/1-detect.md`; each step file ends with a `next_step:` frontmatter pointer to the next, and the final step has `next_step: null`. Follow them in the order they point. You must resolve each step in order.

**Start by reading the path relative to this file at `references/1-detect.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the run needs (`Glob`, `Grep`, `Read`, `Edit`, `Write`, `Bash`, `Agent`, `TaskCreate`, `TaskUpdate`) is already named in this skill.

## State files

Two `/tmp/` files carry state across steps; read them, patch them, and write them back in full when a step says so:

- `/tmp/posthog-cross-sell-opportunities.json` — created by Step 1. The raw per-product detection result.
- `/tmp/posthog-cross-sell-plan.json` — created by Step 3, the single source of truth for what gets proposed/scaffolded thereafter. Each item carries:
  - `id` — stable kebab-case slug (`feature-flags`, `error-tracking`, …).
  - `product` — PostHog product name.
  - `mode` — `cross-sell` | `greenfield` | `gap` (in-use-and-healthy products are dropped, not carried).
  - `competitor` — competitor name when `mode` is `cross-sell`, else `null`.
  - `fit` — `high` | `medium` | `low`.
  - `value` — one or two sentences on the business/analytics upside.
  - `effort` — `S` | `M` | `L`.
  - `evidence` — `file:line` list backing the fit.
  - `classification` — `scaffold` | `propose-only`.
  - `skip_reason` — required when `propose-only`.
  - `plan` — `{ files, approach, snippet }`, added in Step 4 for `scaffold` items.
  - `status` — `proposed` | `planned` | `scaffolded` | `verified` | `failed` | `propose-only`.
  - `notes` — one-line record of what was scaffolded or why it failed.

## Severity / priority ordering

Whenever a step processes items, order them by `fit` (high → medium → low), then by `effort` (S → M → L). The highest-leverage, lowest-cost opportunities land first, so a partial run still delivers the best ones.

## Key principles

- **Code-grounded**: every proposal cites concrete `file:line` evidence. No opportunity without evidence.
- **Plan-driven scaffolding**: every edit traces to a plan item's `plan` block. No freelance code.
- **Minimal, idiomatic diffs**: scaffolds are the smallest working integration, matching the file's existing style. Prefer a feature-gated or clearly-marked addition over sweeping changes.
- **Fail safe**: if a scaffold can't be applied cleanly, mark the item `failed` with a reason instead of guessing. A failed item with a clear note beats a wrong edit.
- **Verify before reporting**: scaffolds are spot-checked mechanically and the project's own typecheck/lint/build is re-run against a baseline recorded before any edit.

## Task list

As soon as you have a rough sense of the work, **call `TaskCreate` immediately** — before reading the first reference file — so the task pane isn't empty. Seed it with the high-level phases you can infer (detect, propose, plan, scaffold, verify, report), then refine with `TaskCreate`/`TaskUpdate` as your understanding sharpens. Mark an item `in_progress` when you start it and `completed` when you finish. Keep titles broad and job-oriented ("Detecting product fit", "Scaffolding viable products"), not file-specific.

## Status

Before beginning each phase or sub-step, emit a plain-text line with the exact prefix `[STATUS]`:

```
[STATUS] Detecting product fit
```

The harness intercepts these and updates the "Working on …" banner. Use them freely — each step file lists the exact strings to emit.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.
- No PostHog SDK found

## Reference files

{references}

## Framework guidelines

{commandments}
