---
next_step: 3-propose.md
---

# Step 2: Record the project toolchain and baseline

The detection result is at `/tmp/posthog-cross-sell-opportunities.json` (Step 1). This step detects the project's package manager and verification command, runs that command once to record a pre-scaffold baseline, and writes `/tmp/posthog-cross-sell-env.json`. It does NOT propose, plan, or edit anything. Later steps need this so Step 6 can tell a scaffold-induced regression apart from a pre-existing failure.

## Status

Emit:

```
[STATUS] Detecting toolchain
[STATUS] Recording baseline
```

## Action

### a. Detect the package manager and commands

From `project_root`, identify the package manager by lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb`/`bun.lock` → bun, `package-lock.json` → npm. For non-JS projects use the manifest's ecosystem (pip/uv, bundler, composer, go, …).

Pick **one** verification command, in preference order:

1. A `typecheck` script in the manifest, else `tsc --noEmit` when `tsconfig.json` exists.
2. A `lint` script.
3. A `build` script.
4. None → record `verify_cmd: null`.

Record the matching `install_cmd` (`pnpm install`, `npm install`, …) so a scaffold that adds a PostHog package can install it.

### b. Record git state

Run `git rev-parse --is-inside-work-tree` and, if a repo, `git status --porcelain`. Record whether the tree is dirty. **Record only** — do not commit, stash, branch, or otherwise mutate git state, and do not abort on a dirty tree.

### c. Run the baseline

If `verify_cmd` is set, run it once from `project_root`. Record whether it passed and, on failure, a one-line summary of the error count and files involved. Do not fix any baseline failure.

### d. Write the env file

`Write` `/tmp/posthog-cross-sell-env.json`:

```json
{
  "package_manager": "pnpm",
  "install_cmd": "pnpm install",
  "verify_cmd": "pnpm typecheck",
  "baseline_pass": true,
  "baseline_summary": null,
  "git": { "repo": true, "dirty": false }
}
```

## Output

The env file exists with all six keys populated (nulls allowed where detection found nothing).
