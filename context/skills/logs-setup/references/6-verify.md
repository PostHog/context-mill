---
title: Verify the setup
next_step: 7-report.md
---

# Step 6, verify the project still builds and the logging path runs

Two things to prove. The project is not broken, and the correlated logging path executes end to end without throwing. Emitting one record is the smoke test for the second; confirming it actually landed in PostHog is the operator's step, not this one.

Do not spawn subagents.

## Status

Emit these as you work.

```
[STATUS] Installing dependencies
[STATUS] Linting files I edited
[STATUS] Running type check
[STATUS] Running build
[STATUS] Emitting a test log record
```

## Install dependencies

Step 2 added package entries without installing. Install once now, using the package manager the project already uses. Infer it from the lockfile, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `poetry.lock`, `uv.lock`, or a `requirements.txt`.

## Lint, type check, build

Read the project's manifest for the scripts it defines. Run the linter and formatter only on the files you edited or created in this session, not across the whole codebase.

The type check is the gate. Run it (`tsc --noEmit`, `mypy`) and treat a clean result as the primary proof the project is not broken. It is fast and runs anywhere, including sandboxes.

The build (`next build`, `python -m py_compile`, or the project's own command) is a stronger but much slower and more fragile check. Agent sandboxes routinely cannot run it: a bundler that needs to bind a port, spawn a subprocess, or reach a database at build time fails for reasons no edit fixes (see the next section). Attempt it at most once, and only after the type check is already clean. When it cannot run in this environment, that is not a setup failure — a clean type check stands as the proof for this step, and the full build becomes an operator follow-up. Do not re-run it with different flags trying to get past an environment limit.

Capture stdout and stderr. Truncate to the failure region if the output is long.

## Fix only what this run caused

Re-run after each fix until clean. Fix only failures this setup introduced, prioritizing the files you edited.

Allowed:

- A wrong import path or missing type on the provider setup, the context, or the attachment point.
- A package version that does not resolve against the project's existing dependency set.
- An `await` missing on an async `headers()` call in Next.js 15 and later.

Not allowed:

- Refactoring unrelated code.
- Fixing pre-existing build errors that have nothing to do with this setup.
- Silencing a type error with `any` or an ignore comment to make the build pass. If a type genuinely cannot be resolved, record it as an error on the verify phase line and let the operator address it. The `tracing_headers` cast from Step 4 is the one known exception, because it covers a gap in a published type definition rather than an unresolved type in the code you wrote.

## When the failure is the environment, not the code

A build can fail for reasons no edit will fix: a sandbox that blocks a subprocess or a port the bundler wants, an environment variable the app reads at build time, a database or API the build expects to reach. Changing flags and running it again resolves none of these, and the build is the slowest command in this run.

Attempt the build once. If it fails, read the error and decide whether it is about the code you wrote or about the environment you are running in. When it is the environment, stop there, record the verify line as a `warning` naming the restriction, and let Step 7 raise it as a manual follow up for the operator to run themselves. Do not run the same build again with different flags.

Pre-existing failures are the same story. A build that was already broken before this run is not yours to fix, and it is not evidence that your changes are wrong.

## Emit one test record

Send exactly one log record through the real logging path so it carries the correlation attributes. This is a smoke test that the path executes without throwing. Whether the record then shows up in PostHog is for the operator to confirm afterwards, not for you to chase here.

Emit it in process, not through a running server — a dev server needs a bound port that agent sandboxes routinely block. Write one small throwaway script that imports the provider and logger you created, emits a single record with `posthogDistinctId` and `sessionId` set explicitly (a request scoped surface's real values if you can reach them, otherwise clearly synthetic ones like `wizard-verify`), force-flushes the provider, and exits. Run it once with whatever runner the project already uses for its own scripts. Make one attempt: if the script cannot run cleanly here, note that on the verify line and move on — do not iterate on harness or runner problems. Delete the script when you are done.

Do not confirm arrival in this session. Do not query PostHog — not with the MCP tools, not with `curl`, not with anything — and do not hunt for an API key. A record takes a moment to land and the tools to check it belong to the operator, not this run. Step 7 tells them exactly where to look. Record delivery as emitted, note that the operator confirms it, and continue. That is the expected outcome, not a failure.

The attribute names matter more than delivery here: `posthogDistinctId` and `sessionId`, spelled exactly, set at emit time. You already ensured that in Step 5, so if the smoke test runs without throwing, this step is done.

## Update the plan file

Edit `.posthog-logs-plan.md` and tick the `verify` phase line.

```
- [x] verify — pass — type check clean, test record emitted (operator confirms delivery)
- [x] verify — warning — type check clean, test record could not be emitted here (<reason>)
- [x] verify — error — <which command failed and a short excerpt>
```

Continue to `7-report.md` regardless of the outcome. The report still needs to be written.
