---
next_step: 5-conclude.md
title: PostHog Setup - Revise
description: Review and fix any errors in the PostHog integration implementation, and confirm it matches the event plan
---

Check the project for errors. Read the package.json file for any type checking or build scripts that may provide input about what to fix. Remember that you can find the source code for any dependency in the node_modules directory. Do not spawn subagents.

Ensure that any components created were actually used.

## Confirm the implementation matches the plan

The dashboard and insights were created up front from `.posthog-events.json`, so the code must match that plan exactly or the insights will show no data. Read `.posthog-events.json` and, for every entry, verify:

- A capture call for that **exact** `event_name` exists in the code (character-for-character — no renamed, merged, or dropped events).
- It lives in the `file` the plan named, or in a location that is clearly justified by the code.

Where the code drifted from the plan, fix the code to match. If a deviation is genuinely intentional and correct (an event had to be renamed, added, or removed during implementation), reconcile the artifacts so the dashboard stays truthful: update `.posthog-events.json` to reflect the real code **and** update the corresponding insight via the PostHog MCP (or add/remove it) to use the actual event name. Report any deviation and how you reconciled it in the status stream.

Once all other tasks are complete, run any linter or prettier-like scripts found in the package.json, but ONLY on the files you have edited or created during this session. Do not run formatting or linting across the entire project's codebase.

## Status

Status to report in this phase:

- Finding and correcting errors
- Report details of any errors you fix
- Confirming every planned event is implemented, with the exact name, in the expected file (report any deviations and how they were reconciled)
- Linting, building and prettying
