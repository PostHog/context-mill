---
title: Clean up and report
---

# Step 5 — Clean up unused packages, lint, build, write the report

Check the project for errors. Read the `package.json` (or equivalent manifest) for any type checking or build scripts that may provide input about what to fix. Remember that you can find the source code for any dependency in the `node_modules` directory. Do not spawn subagents.

Ensure that any components created or files you edited are actually used in the project.

## Status

Emit:

```
[STATUS] Removing source packages
[STATUS] Linting and building
[STATUS] Writing migration report
```

## Action

### a. Remove the `<competitor_name>` packages

Read `.selected-targets.txt` to confirm the migration target. Remove every `<competitor_name>` package from the project's manifest using the package manager detected in Step 2. The `migration-source-<competitor_name>` skill (sourced from `<competitor_docs>`) names the exact package(s) to uninstall for this target — consult it for the authoritative list.

Use `pnpm remove <pkg>` / `npm uninstall <pkg>` / `pip uninstall <pkg>` / `bundle remove <pkg>` / etc. Only remove packages that the project no longer imports — confirm with `Grep` first that no remaining call sites reference them.

Also remove any leftover config files belonging to `<competitor_name>` (e.g. provider-specific config under the project root). Do not touch unrelated config files.

### b. Lint, type check, build

Run any linter or prettier-like scripts found in the project's `package.json` (or equivalent), but **ONLY** on the files you have edited or created during this session. Do not run formatting or linting across the entire project's codebase.

Run the project's type check (e.g. `tsc --noEmit`, `mypy`, etc.) and build (e.g. `next build`, `vite build`, `python -m py_compile`, etc.). Fix any errors that surface, prioritizing failures in the files you edited. Re-run after each fix until clean.

### c. Write the migration report

Create `posthog-migration-report.md` at the project root. It should include a summary of the migration, a table of the call sites that were replaced (target, file, kind, before → after), and a list of packages that were uninstalled. Follow this format:

<wizard-report>
# PostHog migration report

The wizard has migrated this project from `<competitor_name>` to PostHog. [Detailed summary of changes]

## Migrated target

`<competitor_name>` — migration guide: `<competitor_docs>`

## Replaced call sites

[table: file | kind | before → after]

## Removed packages

[bulleted list of packages uninstalled]

## Identification added

[table: file | trigger | user id source]

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

Upon completion, remove `.posthog-migration-plan.json` and `.selected-targets.txt`.
