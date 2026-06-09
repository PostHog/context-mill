# PostHog demo — {display_name}

Read the bundled PostHog guide on {display_name}, then turn it into a concrete task list for this project. Read-only: inspect the project and the guide, propose tasks, and stop. Never edit source or mutate PostHog state.

## What to do

1. Read the bundled guide under `references/` (listed below). It is the source of truth for what good looks like.
2. Scan the project's feature flag usage — SDK setup, flag call sites, and how flags are defined and cleaned up — enough to judge it against the guide.
3. Generate a series of tasks, one per gap between the guide and what the project actually does. Each task names the specific change, cites `file:line` where it applies, and stands on its own.

Call `TaskCreate` as soon as you have a rough sense of the gaps — before a full pass — so the list isn't empty, then `TaskUpdate` to refine as your understanding sharpens. An incomplete list seeded early beats a perfect one seeded late.

## Reference files

{references}

## Key principles

- **Guide-driven**: every task traces back to a recommendation in the bundled guide. No freelance findings.
- **Evidence-based**: cite `file:line` for anything tied to a location.
- **Read-only**: the output is the task list, not a code change.
