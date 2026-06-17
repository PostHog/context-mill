# PostHog Migration — {display_name}

This skill migrates an existing `{display_name}` integration over to PostHog. Two reference files describe what the source SDK looks like (`references/sdk-reference.md`) and how each of its calls maps to PostHog (`references/mapping.md`). Together they are the source of truth for the migration.

## Workflow

The migration runs as a 7 step chain.

1. Confirm the source SDK is in this project (`references/1-presence.md`).
2. Install and initialize the PostHog SDK for this framework (`references/2-install-posthog.md`).
3. Plan every call site replacement and persist the plan to `.posthog-migration-plan.md` (`references/3-plan.md`).
4. Rewrite each call site in place (`references/4-replace.md`).
5. Remove the source SDK from the project (`references/5-cleanup.md`).
6. Verify the project still builds (`references/6-verify.md`).
7. Write the migration report and delete the plan file (`references/7-report.md`).

Each step file points to the next via `next_step` frontmatter. Read them in order, one at a time. Do not preload future steps. Do not re-read a step file once you have moved past it.

## Task list

**Before you do anything else**, make a single call to `TaskCreate` to seed the task pane with the seven items above (one per step, in order). Use broad, job-oriented titles like "Confirm Statsig is in use", "Install PostHog", "Plan call site replacements", etc. The user is watching the pane and shouldn't see it sit empty.

Then, and only then, read `references/1-presence.md` and start the chain.

It's fine if your first list is imprecise. Call `TaskCreate` again (or `TaskUpdate` to refine existing items) every time your understanding sharpens. Use `TaskUpdate` to mark items `in_progress` when you start them and `completed` when you finish. Keeping the list current matters more than getting it right on the first call.

## Variant references

`references/sdk-reference.md` describes the source SDK's packages, init shapes, and API surface. `references/mapping.md` translates each source SDK call into its PostHog equivalent. Read them when a step tells you to. Do not WebFetch migration docs, everything you need is on disk.

## User decision points

Call `mcp__wizard-tools__wizard_ask` when a step needs the operator to choose, confirm, or supply a value. The tool surfaces a modal in the wizard UI, blocks until they answer, and returns the answers keyed by question id. Batch related questions into one call. Do not ask via plain chat.

## Live activity

Emit `[STATUS] <short phrase>` lines whenever you start a new sub task. The wizard reads them and updates the spinner. Use them freely, they are cheap. Each step file names the status phrases it expects.

## Migration plan file

The plan file lives at `.posthog-migration-plan.md` at the project root. Step 3 writes it, Steps 4 to 6 update it, Step 7 reads it for the report and deletes it. Use `Write`, `Read`, and `Edit` directly, no MCP tools, no audit ledger.

The file has two sections. A phase checklist tracks each step's outcome. A sites table holds one row per source SDK call site that the plan and replace steps work through. Step 3 defines the exact format and the later steps follow it.

## Outcome statuses

Mark each phase and each site row as one of these.

- `pass`, the step completed cleanly.
- `warning`, the step completed but the operator should look at it.
- `error`, the step failed and you could not auto recover.

## Key principles

Replace, do not add. Only rewrite source SDK call sites that already exist. Do not introduce new captures, new flag evaluations, or new identification beyond what the mapping doc requires.

Do not opt out of PostHog's default SDK behavior. When initializing PostHog, pass only what the variant mapping requires (token, host, and any explicitly listed options). Never set `autocapture: false`, `disable_session_recording: true`, `capture_pageview: false`, or similar disable-by-default flags to match the source SDK's narrower surface — those defaults are SDK behavior, not net-new instrumentation, and disabling them defeats the migration.

The mapping doc is canonical. If a call shape is not covered, mark the site as a warning and leave the source unchanged.

Keep PostHog keys in environment variables. Never hardcode them.

Keep edits minimal. Preserve surrounding code, formatting, and imports unrelated to the source SDK. If a file has integration code for other tools, leave that code alone.

Do not commit. The operator reviews the diff and commits when ready.

## Abort statuses

Emit `[ABORT] <reason>` and stop when an abort case fires. The wizard catches these and terminates the run.

- `[ABORT] No source-SDK calls found`, when Step 1 finds no trace of the source SDK.

## Framework guidelines

{commandments}
