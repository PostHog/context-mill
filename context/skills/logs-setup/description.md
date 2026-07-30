# PostHog Logs — {display_name}

This skill sends this project's logs to PostHog and, more importantly, correlates them. A correlated log record carries the `posthogDistinctId` and `sessionId` of the request that produced it, so a log line in PostHog links back to the person who caused it and to the session replay of them causing it.

Getting logs to arrive is table stakes and the installation docs already cover it. Correlation is the part that needs to read this codebase, and it is the reason this skill exists.

## Workflow

The setup runs as a 7 step chain.

1. Detect the runtimes, the existing logging, and the PostHog SDKs already present (`references/1-detect.md`).
2. Install the OTLP log export alongside the existing logging (`references/2-install.md`).
3. Decide how far correlation can go in this codebase and persist the plan to `.posthog-logs-plan.md` (`references/3-plan.md`).
4. Establish a request scoped identity context (`references/4-context.md`).
5. Attach the identity to every log record from one place (`references/5-attach.md`).
6. Verify the project still builds and a correlated record actually arrives (`references/6-verify.md`).
7. Write the report and delete the plan file (`references/7-report.md`).

Each step file points to the next via `next_step` frontmatter. Read them in order, one at a time. Do not preload future steps. Do not re-read a step file once you have moved past it.

## Task list

**Before you do anything else**, make a single call to `TaskCreate` to seed the task pane with the seven items above (one per step, in order). Use broad, job-oriented titles like "Detect logging setup", "Install log export", "Plan correlation", etc. The user is watching the pane and shouldn't see it sit empty.

Then, and only then, read `references/1-detect.md` and start the chain.

It's fine if your first list is imprecise. Call `TaskCreate` again (or `TaskUpdate` to refine existing items) every time your understanding sharpens. Use `TaskUpdate` to mark items `in_progress` when you start them and `completed` when you finish. Keeping the list current matters more than getting it right on the first call.

## Correlation tiers

Correlation is not all or nothing. Every project lands on one of these tiers, and the honest outcome is to reach the best tier this codebase supports and then say so.

- **`session`** — the record carries both `posthogDistinctId` and `sessionId`. A log line links to the person and opens the session replay. This is the goal.
- **`person`** — the record carries `posthogDistinctId` only. Logs appear on the person's profile, but there is no replay to open. This is the correct outcome when the project has no browser client, or when session replay is off.
- **`none`** — no identity is reachable at log time. The logs still arrive and are still searchable, they just aren't linked to anyone.

A lower tier reached deliberately and reported clearly is a good outcome. Wiring that looks like `session` but silently attaches nothing is not. Never invent an identifier to reach a higher tier.

## Client side logs are already correlated

If this project calls `posthog.captureLog` or `posthog.logger.*` from the JavaScript web SDK or the React Native SDK, those records already carry the current distinct id and session id. The SDK attaches them. Do not add wiring for them and do not count them as work.

Every step in this chain is about **server emitted** records, which is where the identity is missing.

## User decision points

Call `mcp__wizard-tools__wizard_ask` when a step needs the operator to choose, confirm, or supply a value. The tool surfaces a modal in the wizard UI, blocks until they answer, and returns the answers keyed by question id. Batch related questions into one call. Do not ask via plain chat.

## Live activity

Emit `[STATUS] <short phrase>` lines whenever you start a new sub task. The wizard reads them and updates the spinner. Use them freely, they are cheap. Each step file names the status phrases it expects.

## Logs plan file

The plan file lives at `.posthog-logs-plan.md` at the project root. Step 3 writes it, Steps 4 to 6 update it, Step 7 reads it for the report and deletes it. Use `Write`, `Read`, and `Edit` directly, no MCP tools, no audit ledger.

The file has two sections. A phase checklist tracks each step's outcome. A surfaces table holds one row per place that emits logs, with the correlation tier that surface reached. Step 3 defines the exact format and the later steps follow it.

## Outcome statuses

Mark each phase and each surface row as one of these.

- `pass`, the step completed cleanly.
- `warning`, the step completed but the operator should look at it.
- `error`, the step failed and you could not auto recover.

## Reference documentation

Everything you need is on disk. Do not WebFetch the logs docs.

{references}

## Key principles

Additive, never disruptive. Existing logging keeps working exactly as it does today. You are adding an export path and enriching records, not replacing a logging library, not changing log levels, and not rewriting log messages.

Attach identity in one place, not at every call site. A codebase with two hundred log statements should end this run with two hundred correlated log statements and roughly one new file. If you find yourself editing a third individual log call to add attributes by hand, stop, and go back to the shared mechanism in Step 5.

Prefer the authenticated user id over the header. The `X-POSTHOG-DISTINCT-ID` header is set by the browser and is therefore client controlled. Where the server already knows who the request belongs to, that id wins. Fall back to the header only for anonymous traffic.

Use the project token, not a personal API key. The log export authenticates with the `phc_` project token, the same one the PostHog SDK uses. A `phx_` personal API key is the wrong credential and will fail. Read it from an environment variable, never hardcode it.

Match the region to the project. The installation docs hardcode the US ingestion host. If this project is on EU, that endpoint silently accepts nothing useful. Step 2 resolves this before writing any endpoint.

Keep edits minimal. Preserve surrounding code, formatting, and unrelated imports. If a file has integration code for other tools, leave that code alone.

Do not commit. The operator reviews the diff and commits when ready.

## Abort statuses

Emit `[ABORT] <reason>` and stop when an abort case fires. The wizard catches these and terminates the run.

- `[ABORT] No supported runtime found`, when Step 1 finds no {display_name} application to instrument.

## Framework guidelines

{commandments}
