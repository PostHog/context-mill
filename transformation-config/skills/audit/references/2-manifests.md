# Step 2 — Scan manifests

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step has exactly one action: scan dependency manifests and resolve `sdk-installed` and `sdk-up-to-date`.

## TodoWrite

Update the in-progress task's `activeForm` to `Scanning dependency manifests`. Status and content stay the same.

## Action

1. `Glob` for the project's dependency manifests by name: `package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, `build.gradle`, `Podfile`. One Glob is enough. **Do not read any code**.
2. `Read` each manifest the Glob returned. List each PostHog SDK and its installed version. No source-tree scanning.
3. If no PostHog SDK is in any manifest, emit `[ABORT] No PostHog SDK found`. The wizard middleware catches `[ABORT]` and terminates the run — do not halt yourself.
4. For each detected SDK, run `Bash` once to look up the latest published version (e.g. `npm view <pkg> version`, `pip index versions`).
5. `Write` `.posthog-audit-checks.json` with `sdk-installed` and `sdk-up-to-date` resolved. Leave `init-correct` as `pending`.

### Resolution rules

`sdk-installed`:
- `pass`: at least one PostHog SDK in a manifest. Record each SDK + version in `details`.

`sdk-up-to-date`:
- `pass`: at the latest minor.
- `suggestion`: patch-only behind.
- `warning`: more than one minor behind.
- `error`: one or more major versions behind.
- Browser-side projects: also record a `warning` if browser and server runtimes share a single SDK (best-practices: "Use the SDK that matches each runtime").

## Status

Status to report in this phase:

- Scanning manifests
- Resolved SDK install + version checks

---

**Upon completion, continue with:** [3-init.md](3-init.md)
