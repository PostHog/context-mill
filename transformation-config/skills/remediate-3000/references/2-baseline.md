---
next_step: 3-dependencies.md
---

# Step 2: Record the project toolchain and baseline

The plan is at `/tmp/posthog-remediation-plan.json` (written by step 1). This step detects the project's package manager and verification command, runs that command once to record a pre-edit baseline, and writes `/tmp/posthog-remediation-env.json`. It does NOT edit anything (steps 3–4) and does NOT judge fixes (step 5). Do not re-read step 1.

## Status

Emit:

```
[STATUS] Detecting toolchain
[STATUS] Recording baseline
```

## Action

### a. Detect the package manager and commands

From the `project_root` recorded in the plan, identify the package manager by lockfile: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `bun.lockb`/`bun.lock` → bun, `package-lock.json` → npm. For non-JS projects use the manifest the audit found (`requirements.txt`/`pyproject.toml` → pip/uv, `Gemfile` → bundler, `composer.json` → composer, `go.mod` → go, etc.).

Pick **one** verification command, in preference order:

1. A `typecheck` script in the manifest, else `tsc --noEmit` when `tsconfig.json` exists.
2. A `lint` script.
3. A `build` script.
4. None → record `verify_cmd: null`.

### b. Record git state

Run `git rev-parse --is-inside-work-tree` and, if a repo, `git status --porcelain`. Record whether the tree is dirty. **Record only** — do not commit, stash, branch, or otherwise mutate git state, and do not abort on a dirty tree.

### c. Run the baseline

If `verify_cmd` is set, run it once from `project_root`. Record whether it passed and, on failure, a one-line summary of the error count and the files involved — step 5 uses this to tell pre-existing failures apart from regressions caused by edits. Do not attempt to fix any baseline failure.

### d. Write the env file

`Write` `/tmp/posthog-remediation-env.json`:

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
