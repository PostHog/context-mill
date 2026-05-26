---
title: Remove the source SDK
next_step: 6-verify.md
---

# Step 5, remove the source SDK

The call sites are gone. Now remove the package, and any provider specific config files the source SDK left at the project root.

## Status

Emit these as you work.

```
[STATUS] Removing source-SDK packages
[STATUS] Removing leftover source-SDK config files
```

## Confirm no remaining imports

Grep for the source SDK package names listed in the variant reference. If any imports remain, Step 4 missed a call site. Tick the `cleanup` phase as `[x] cleanup — error — Remaining source-SDK imports in <file:line>` and stop. Do not remove the package. The report will surface the gap.

## Remove the packages

Cross reference the variant's package list against the project's manifest. Only remove packages that are present.

Pick the package manager from the lockfile at the project root.

- `pnpm-lock.yaml`, pnpm.
- `package-lock.json`, npm.
- `yarn.lock`, yarn.
- `bun.lockb`, bun.
- `composer.lock`, composer.
- `Gemfile.lock`, bundler.
- `poetry.lock`, poetry.

For non JS ecosystems, the variant reference names the manifest the source SDK lives in.

Invoke the matching remove command, e.g. `pnpm remove <pkg> [<pkg>...]`, `npm uninstall <pkg> [<pkg>...]`, `yarn remove <pkg> [<pkg>...]`, `composer remove <vendor/pkg>`, `bundle remove <gem>`, `poetry remove <pkg>`. Remove all present packages in a single command where the package manager supports it.

If the source SDK is present only as a vendored copy or transitive dep, skip the removal and record that in the cleanup phase line.

## Run install

PostHog was added to the manifest in Step 2 without invoking the package manager. Run the matching install command now (`pnpm install`, `npm install`, `yarn`, `bundle install`, `poetry install`, etc.) so the new dependency and the removals above land in the lockfile in a single resolution.

If the install fails, diagnose and fix it before continuing — common causes are a pinned `packageManager` version the sandbox can't fetch, a stale lockfile, or peer-dep conflicts. Override the pin, refresh the lockfile, or pass the package manager's accept-peer-deps flag as needed. Do not skip the install; Step 6 (verify) needs a working `node_modules`.

## Remove leftover config files

Some source SDKs leave provider specific config files at the project root such as dotfiles, JSON configs, or generated metadata. The variant reference names them. Delete only those files.

## Update the plan file

Edit `.posthog-migration-plan.md` and tick the `cleanup` phase line with the outcome.

```
- [x] cleanup — pass — Removed: <pkg-list>; Deleted: <files>
- [x] cleanup — warning — No source-SDK packages in manifest
- [x] cleanup — error — <reason>
```

Continue to `6-verify.md`.
