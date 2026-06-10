---
title: Verify the project still builds
next_step: 7-report.md
---

# Step 6, verify the project still builds

Check that the project still lints, type checks, and builds after the migration. Read `package.json` or the equivalent manifest for the scripts the project uses. The source for any dependency is in `node_modules` if you need it to disambiguate an error. Do not spawn subagents.

Confirm that the components and imports you edited in Step 4 are actually wired up.

## Status

Emit these as you work.

```
[STATUS] Linting files I edited
[STATUS] Running type check
[STATUS] Running build
```

## Lint the files you edited

Run the project's linter and formatter scripts, but only on the files you edited or created in this session. Do not run them across the whole codebase.

## Type check and build

Run the project's type check (e.g. `tsc --noEmit`, `mypy`) and build (e.g. `next build`, `vite build`, `python -m py_compile`). Use the package manager you used in Step 5. Capture stdout and stderr. Truncate to the failure region if output is long.

## Fix migration induced failures only

Re-run after each fix until clean. Fix only failures caused by the migration, prioritizing files you edited.

Allowed:

- Remove a leftover source SDK import in a file Step 4 already touched.
- Adjust a PostHog call's argument shape when the variant mapping's literal output did not match the surrounding TypeScript or JSDoc types, only if the variant mapping reference documents the alternative shape.

Not allowed:

- Refactor unrelated code.
- Fix pre existing build errors that have nothing to do with the source SDK or PostHog.
- Auto fix PostHog wiring issues from Step 2. Record the failure in the verify phase line and let the operator address them.

## Update the plan file

Edit `.posthog-migration-plan.md` and tick the `verify` phase line.

```
- [x] verify — pass — lint + typecheck + build clean
- [x] verify — error — <which command failed and a short excerpt>
```

Continue to `7-report.md` regardless of the outcome. The report still needs to be written.
