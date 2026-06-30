# PostHog Ingestion Warnings — diagnose & fix

This skill diagnoses a PostHog project's **ingestion warnings** and fixes the instrumentation producing them. Ingestion warnings are events PostHog had to drop, mis-merge, or degrade as they came in — so the affected data is incomplete or inaccurate. You can't fix this after the fact by reprocessing; you have to fix the code that sends the bad events.

The skill is **data-first**: it queries `system.ingestion_warnings` to see which warning types are *actually firing* for this project, then traces each firing type back to the offending code and applies the fix. It does not blindly rewrite working instrumentation — only the patterns tied to a warning the project is really hitting.

**Start by reading `references/1-triage.md`.** Do not Glob, ls, or find the skill directory. Do not preload `2-fix.md` or `3-report.md`. Read each step file once, in order; do not re-read an earlier step once you've moved past it. Do not re-read this file.

Each step persists what the next step needs to a scratch file at the project root (`.posthog-ingestion-warnings.json`) so later steps never have to re-open earlier step files. The final step deletes that scratch file and writes the report.

## Tools

`ToolSearch` is only for loading a tool by its exact name when the SDK has it deferred (e.g. `select:Grep`). Do **not** use it to browse for other tools — every tool this skill needs (`Glob`, `Grep`, `Read`, `Edit`, `Write`, `Bash`, and `mcp__posthog__execute-sql` for reading the project's warnings) is already named in the step files.

Do **not** call `TaskCreate` / `TaskUpdate` / `TaskGet` / `TaskList`. Progress is reported through `[STATUS]` lines and the scratch file, not a task list.

## Status — `[STATUS]`

The live "Working on …" banner reads from `[STATUS]` lines you emit in plain text. Whenever you start a new sub-step, emit a line like:

```
[STATUS] Querying ingestion warnings
```

Each step file lists the exact `[STATUS]` strings to emit. Use them freely — they are cheap.

## Abort — `[ABORT]`

Report unrecoverable preconditions with `[ABORT] <reason>` on its own line. The wizard runner catches it and terminates the run — you do not need to halt yourself afterwards. Abort reasons this skill uses:

- No PostHog SDK initialization found in the project
- Could not read ingestion warnings and no PostHog instrumentation found to scan

## Guiding tenets

Follow these for every fix:

1. **Fix the cause, not the symptom.** Each warning maps to a specific SDK misuse. Change the code that sends the bad event; never add filtering, try/catch swallowing, or property stripping that just hides the warning while keeping the broken data.
2. **Only touch what a firing warning points to.** If the triage query says only `invalid_heatmap_data` is firing, fix only that. Don't "while I'm here" refactor other instrumentation.
3. **Never fabricate identifiers.** When a fix needs a stable `distinct_id` or user id and it isn't in scope, thread it from a caller that has it, or leave a clearly-marked `TODO` and record it in the report — never substitute a guessed or generic value.
4. **Preserve existing behavior.** Make minimal, additive edits. Don't restructure unrelated code or change event names, payloads, or call sites beyond what the fix requires.
5. **Report what you couldn't fix.** A warning whose producing code you can't locate, or that needs a human decision, goes in the report under "Needs manual attention" — don't guess.

## Reference files

{references}

{commandments}
