# PostHog Migration

This skill migrates an existing `<competitor_name>` integration over to PostHog. The canonical replacement patterns are documented across the files in this skill's `references/` directory; the agent reads them as needed during planning and migration.

## Workflow

The migration runs as a 5-step linear chain:

1. Confirm `<competitor_name>` calls are present in the project (`references/1-discover-targets.md`)
2. Detect the project framework, install the matching integration skill, and add the PostHog SDK package — **without** initializing it (`references/2-install-sdk.md`)
3. Plan the migration: enumerate every call site of `<competitor_name>` plus identification opportunities, write the plan to `.posthog-migration-plan.json` (`references/3-plan.md`)
4. Perform the migration: replace call sites and add initialization + identification per the migration docs in this skill's `references/` directory (`references/4-migrate.md`)
5. Clean up: remove unused packages, run linter and build, write the migration report (`references/5-cleanup.md`)

Each step file ends with a pointer to the next. Follow them in the order written. Resolve each step before reading the next.

**Start by reading the path relative to this file at `references/1-discover-targets.md`.** Do not Glob, ls, or find the skill directory. Do not preload future steps. Do not re-read a step file once you've moved past it. Do not re-read SKILL.md.

## Reference files

- `references/<competitor_id>.md` — Canonical PostHog migration guide for `<competitor_name>`.
- `references/adding-feature-flag-code.md` — How to add PostHog feature flag code to the project.
- `references/react.md` — PostHog feature flag installation reference for React projects.

The example project shows the target implementation pattern. Consult the documentation for API details.

`ToolSearch` is only for loading a tool by exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool the migration needs (`Glob`, `Grep`, `Read`, `Write`, `Edit`, `Bash`, `Task`, the named `mcp__wizard-tools__*` tools) is already named in this skill or its step files.

## Task list

As soon as you've read this description and have a rough sense of the work, **call `TodoWrite` immediately** — before reading any reference file. The user is watching the task pane and shouldn't see it sit empty.

It's fine if your first list is incomplete or imprecise. Seed it with whatever high-level items you can infer from the workflow overview above, then **call `TodoWrite` again** every time your understanding sharpens: after you read a step file, after planning surfaces concrete sub-tasks, after a phase reveals work you didn't anticipate. Mark items `in_progress` when you start them and `completed` when you finish. The wizard surfaces this list in real time; keeping it current is more important than getting it right on the first call.

## User decision points

Whenever a step needs the user to make a choice (pick a target, confirm a path, supply a value), call the wizard MCP tool `mcp__wizard-tools__prompt_user`. It surfaces a modal in the wizard TUI, blocks until the user answers, and returns the answer as JSON in the tool result.

Modes:

- `mode: "single"` — pick one option. Pass `options: [{ label, value }, ...]`. Returns the chosen `value` as a string.
- `mode: "multi"` — pick zero or more options. Same `options` shape. Returns an array of selected `value`s.
- `mode: "text"` — free-form input. Pass an optional `placeholder`. Returns the entered string.

Always pass a clear `title` and `message`. Do not ask the user via plain chat — the wizard owns user interaction.

## Live activity — `[STATUS]`

The "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, write a line like:

```
[STATUS] Discovering migration targets
```

The wizard intercepts these and updates the spinner. Use them freely — they are cheap. Each step file lists the exact `[STATUS]` strings to emit at each sub-step.

## Key principles

- **Migration-only scope**: replace existing `<competitor_name>` call sites with PostHog equivalents. Do **not** add new event captures or instrument new surfaces beyond what the migration guide and identification require.
- **Migration guide is canonical**: the migration docs in this skill's `references/` directory are the source of truth for replacement patterns. Don't improvise.
- **Environment variables**: always source PostHog keys from environment variables. Never hardcode them.
- **Minimal changes**: don't restructure or rewrite existing files; replace call sites in place. If a file already has integration code for other tools, leave it alone except for the `<competitor_name>` calls being migrated.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages. The wizard catches these and terminates the run — do not halt yourself.

- `[ABORT] No <competitor_name> calls found` — Step 1, when the project contains no `<competitor_name>` references.
- `[ABORT] No project framework detected` — Step 2, when no manifest matches a supported framework.

## Framework guidelines

{commandments}
