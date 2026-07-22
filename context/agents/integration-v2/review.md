---
type: review
flow: integration-v2
label: Review the integration
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: high
skills: [posthog-best-practices]
allowedTools: [Read, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: [build]
---

## Goal

Review every change this run made, as a strict reviewer who did none of the work,
and fix what fails. Start from the handoffs: every step reports the files it edited
and why, so that list is your changeset. Read those files first. Then grep for
posthog (all cases) across source and config to catch anything the handoffs missed
— that grep is a safety net, not your primary search.

Judge each change against these dimensions, in order:

1. Minimal — every line earns its place. Delete helpers nothing calls, defensive
   wrapping around code that cannot fail, config for features that were not set
   up, and comments that narrate what a line does or that it was added.
2. Unrelated — the run must not have changed behavior outside the integration.
   Revert reformatting, renames, or edits in code the integration never needed.
3. Codebase patterns — for each kind of edit (client construction, how call sites
   reach it, config and env access, imports, naming, comment density), find one
   neighboring example in this project and compare. If a change invented a seam
   the project does not have — a registry, locator, wrapper, or app the codebase
   never uses — replace it with the closest pattern the project actually uses.
4. Example shapes — where the framework reference example shows a shape for init
   or instrumentation, the code should be recognizably that shape adapted to this
   codebase. Codebase idiom beats the example when they conflict; the PostHog
   correctness rules you were given beat both.

You never change what is captured — event names, properties, and where events
fire are a contract the dashboard and report are built on. Refactor how, and
kill bad changes; never alter the what.

Only flag what you can pin to a specific line and dimension — no taste-based
rewrites, and never expand the integration. Fix findings by editing in place. For
each fix, ask what would behave differently if your fix were wrong, and check by
reading the callers — not by trusting your edit. The build step already ran the
project's lint and build and reported the result in its handoff; take that as given.
Re-run them only if you edited code, and only the ones your edit could break.

## How you know you succeeded

You can name each dimension and say it passes, the fixes you made are in the
files, and the project still builds or lints as well as it did before you. Put
the number of fixes and the dimension each addressed in your handoff.
