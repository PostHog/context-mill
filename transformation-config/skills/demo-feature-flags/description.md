# PostHog demo — {display_name}

Read the bundled PostHog guide on {display_name}, then turn it into a concrete task list for this project. Read-only: inspect the project and the guide, propose tasks, and stop. Never edit source or mutate PostHog state.

## What to do

1. Read the bundled guide under `references/` (listed below). It is the source of truth for what good looks like.
2. **The moment you've finished reading it, form a plan and seed the task list — before scanning the project or doing anything else.** Turn the guide's recommendations into a plan and call `TaskCreate` right away, one task per area you intend to check.
3. Scan the project's feature flag usage — SDK setup, flag call sites, and how flags are defined and cleaned up — and refine the tasks (`TaskUpdate`) as each gap becomes concrete. Each task names the specific change, cites `file:line` where it applies, and stands on its own.

## Task list

As soon as you've read the bundled guide, **call `TaskCreate` immediately** — before scanning the project or starting any analysis — so the task pane isn't empty. Seed it with the plan you just formed: one broad item per best-practice area the guide covers. It's fine if the first list is incomplete — seed the high-level items you can infer, then call `TaskCreate` again (or `TaskUpdate` to refine existing items) every time your understanding sharpens. Use `TaskUpdate` to mark an item `in_progress` when you start checking it and `completed` when its task is written. Keeping the list current matters more than getting it right on the first call.

Keep task titles broad and job-oriented — describe the area of work (e.g. "Auditing flag rollout hygiene", "Checking stale-flag cleanup", "Reviewing default-value fallbacks"), not the specific files, paths, or symbols involved. Adjust the names to the project and the guide's contents.

## Reference files

{references}

## Key principles

- **Guide-driven**: every task traces back to a recommendation in the bundled guide. No freelance findings.
- **Evidence-based**: cite `file:line` for anything tied to a location.
- **Read-only**: the output is the task list, not a code change.
