---
next_step: 4-conclude.md
title: PostHog Setup - Revise
description: Review and fix any errors in the PostHog integration implementation
---

Check the project for errors. Read the package.json file for any type checking or build scripts that may provide input about what to fix. Remember that you can find the source code for any dependency in the node_modules directory. Do not spawn subagents.

Ensure that any components created were actually used.

Install any dependencies the AI Observability and Logs steps recorded before
verification, adding each by bare package name with the project's package
manager so it resolves real versions — do not guess version pins. The app's
existing dependencies are not yours to touch: never upgrade, downgrade, or
re-add a package this integration did not introduce. On a peer conflict,
install an older instrumentation version that fits the app's versions — step
down major versions with the package manager (`pkg@^7`, then `@^6`, …) for a
few attempts; if none fits, revert that piece of instrumentation and note it
in the report. Include their changed files
in this review and check that Logs preserved any AIO tracing setup. Verification
of delivery belongs to the user's checklist; do not make paid LLM calls.

Once all other tasks are complete, run any linter or prettier-like scripts found in the package.json, but ONLY on the files you have edited or created during this session. Do not run formatting or linting across the entire project's codebase.

## Status

Status to report in this phase:

- Finding and correcting errors
- Report details of any errors you fix
- Linting, building and prettying
