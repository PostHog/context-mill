---
title: Verify the setup
next_step: 7-report.md
---

# Step 6, verify the project still builds and a record arrives

Two things to prove. The project is not broken, and a log record actually reaches PostHog with its correlation attributes intact.

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

Read the project's manifest for the scripts it defines. Run the linter and formatter only on the files you edited or created in this session, not across the whole codebase. Then run the project's type check (`tsc --noEmit`, `mypy`) and build (`next build`, `python -m py_compile`, or the project's own command).

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
- Silencing a type error with `any` or an ignore comment to make the build pass. If a type genuinely cannot be resolved, record it as an error on the verify phase line and let the operator address it.

## Emit one test record

Send exactly one log record through the real path, from a request scoped surface if the project has one, so it carries correlation attributes.

Prefer a route the project already exposes over writing a new one. Start the dev server, make one request, then stop the server. If the project cannot be started here, say so on the verify line rather than inventing a harness for it.

Then confirm the record arrived. Use the PostHog MCP tools if they are available in this session to query the logs for the record you just emitted. Check three things: the record is present, `posthogDistinctId` is set on it, and `sessionId` is set on it if the plan predicted the `session` tier.

If the MCP tools are not available, do not guess and do not claim the record arrived. Record on the plan that delivery was not verified, and let the report tell the operator how to check for themselves.

A record that arrives without its attributes is the most valuable failure this step can find. It usually means the attribute names are wrong or the context was empty at emit time. Fix it here, since the operator will otherwise discover it days later while trying to debug something else.

## Update the plan file

Edit `.posthog-logs-plan.md` and tick the `verify` phase line.

```
- [x] verify — pass — build clean, correlated record confirmed in PostHog
- [x] verify — warning — build clean, delivery not verified (<reason>)
- [x] verify — error — <which command failed and a short excerpt>
```

Continue to `7-report.md` regardless of the outcome. The report still needs to be written.
