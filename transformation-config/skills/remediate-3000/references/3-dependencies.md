---
next_step: 4-code-fixes.md
---

# Step 3: Apply dependency fixes

This step applies the plan items whose entire fix is a dependency-manifest version bump (e.g. an `sdk-up-to-date` finding). It does NOT touch source files (step 4) and does NOT run the project's verify command (step 5). The plan is at `/tmp/posthog-remediation-plan.json`; the toolchain is at `/tmp/posthog-remediation-env.json`.

## Status

Emit:

```
[STATUS] Updating PostHog SDK versions
```

## Action

### a. Select items

Read the plan. Select items with `status: "planned"` whose `recommendation` edits only dependency manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, `go.mod`, …). If there are none, emit `[STATUS] No dependency fixes needed` and continue to the next step.

### b. Re-verify target versions

The audit's "latest" versions may have moved since the report was written. For each package, run **one** `Bash` registry lookup (`npm view <pkg> version` for npm; the equivalent for other registries) and use the result as the target.

### c. Edit the manifest

Update each package's version range to the latest, **matching the project's existing range style** (`^`, `~`, or exact — copy whatever the manifest already uses). Edit only the PostHog packages the plan items name.

### d. Install

Run the `install_cmd` from the env file, from `project_root`. If the install fails, revert the manifest edit for the failing package and record the error.

### e. Update the plan

Read the plan, set each selected item's `status` to `fixed` (or `failed`) with a one-line `notes` (e.g. `posthog-js ^1.341.0 → ^1.381.0, install ok`), and write the file back in full.

## Output

The plan file reflects a terminal `fixed`/`failed` status for every dependency item, and the lockfile matches the edited manifest (install completed).
