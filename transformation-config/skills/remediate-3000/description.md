# PostHog Remediate 3000

This skill is the write-side companion to `audit-3000`. It consumes the audit report that skill produces (`posthog-audit-report.md` at the project root), turns every finding into a classified remediation plan, and **applies the safe fixes directly to the project source** — dependency bumps, identity fixes, PII removal, duplicate-event removal, event-name alignment, init-config additions, and instrumentation gap fills. Fixes that require mutating PostHog state (editing insights, disabling flags) are **never executed** — they are rendered as copy-paste prompts in the final report. Greenfield product adoption (new Surveys, Logs, LLM Observability, Feature Flags usage) is feature work, not remediation — those findings are listed as skipped with reasons.

**Write contract.** Unlike the audit, this skill edits project source files — that is its job. But it only edits files named by a plan item (or files the item's recommendation explicitly describes), it never runs `git commit`, `git push`, or any other git mutation, it never mutates PostHog state through MCP, and it creates exactly **one** new file at the project root: `posthog-remediation-report.md`. Intermediate state lives in `/tmp/` while the chain runs (`/tmp/posthog-remediation-plan.json`, `/tmp/posthog-remediation-env.json`) and the final step deletes both. The operator reviews the diff and commits — not this skill.

Perform only the fixes derived from the audit report. Do not hunt for new findings — re-running the audit is the operator's job, and the final report tells them to.

## Workflow

The remediation runs as a step chain. **The exact step list lives in the reference files themselves, not in this overview.** Step 1 lives at `references/1-intake.md`; each step file ends with a `next_step:` frontmatter pointer to the next, and the final step has `next_step: null`. Follow them in the order they point. You must resolve each step in order before any source-tree exploration.

**Start by reading the path relative to this file at `references/1-intake.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the remediation needs (`Glob`, `Grep`, `Read`, `Edit`, `Write`, `Bash`, `Agent`) is already named in this skill.

**Do not call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`.** The remediation doesn't track its own task list — progress comes from the plan file plus `[STATUS]` lines.

## Remediation plan file

The plan lives at `/tmp/posthog-remediation-plan.json` and is the single source of truth for what gets fixed. Step 1 creates it; later steps update item statuses by reading the file, patching it, and writing it back in full. Each item carries:

- `id` — stable kebab-case slug derived from the finding's check name.
- `severity` — `error` | `warning` | `suggestion` (from the audit report).
- `area` / `check` — copied from the report's Problematic items table.
- `files` — every `path:line` the finding references.
- `summary` — the finding's Diagnosis, condensed to one or two sentences.
- `recommendation` — the report's full Recommended block, including code snippets.
- `classification` — `auto-fix` | `posthog-side` | `skip`.
- `skip_reason` — required when classification is not `auto-fix`.
- `status` — `planned` | `fixed` | `verified` | `failed` | `skipped`.
- `notes` — one-line record of what was changed or why it failed.

## Severity ordering

Within any step that applies fixes, `error` items are applied before `warning` items, and `warning` items before `suggestion` items. The most impactful fixes land first, so a partial run still leaves the project better off.

## Key principles

- **Plan-driven**: every edit traces back to a plan item, which traces back to a finding in the audit report. No freelance fixes.
- **Minimal diffs**: adapt the report's recommended snippet to the file's actual current code and style. Anchor on code, not on the report's line numbers — they may have drifted since the audit ran.
- **Fail safe**: if a fix can't be applied safely (code moved, conflicting change), mark the item `failed` with a reason instead of guessing. A failed item with a clear note beats a wrong edit.
- **Verify before reporting**: fixes are spot-checked mechanically and the project's own typecheck/lint/build is re-run against a baseline recorded before any edit.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.
- No audit report found

## Reference files

{references}

## Framework guidelines

## Task list

  As soon as you have a rough sense of the work, **call `TaskCreate` immediately** — before reading any reference file or starting analysis — so the task pane isn't empty. It's fine
  if the first list is incomplete: seed it with the high-level items you can infer, then call `TaskCreate` again (or `TaskUpdate` to refine existing items) every time your
  understanding sharpens. Use `TaskUpdate` to mark an item `in_progress` when you start it and `completed` when you finish. Keeping the list current matters more than getting it
  right on the first call.

  Keep task titles broad and job-oriented — describe the purpose or area of work (e.g. "Planning the migration", "Wiring up auth", "Writing tests"), not the specific files, paths,
  or symbols involved. Adjust the names to the user's project and context.

  ## Status

  Before beginning each phase or sub-step, emit a plain-text line with the exact prefix `[STATUS]`:

  [STATUS] Checking project structure

  The harness intercepts these and updates the "Working on …" banner. Use them freely — they are cheap.
