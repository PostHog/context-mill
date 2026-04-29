# Step 2 — SDK installed + SDK up-to-date

This step is intentionally narrow. It runs **before any other project work**. Resolve exactly two checks: `sdk-installed` and `sdk-up-to-date`. **Do not** read source code, locate init sites, look at `.env*` files, or scan for identify/capture call sites in this step — that all belongs to later steps.

## Status

Emit:

```
[STATUS] Scanning manifests
[STATUS] Checking SDK version
```

## Action

### a. Scan manifests

Run **one** `Glob` for dependency manifests by name: `package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, `build.gradle`, `Podfile`. `Read` each manifest the Glob returned. Do not read anything else.

If no PostHog SDK is in any manifest, emit `[ABORT] No PostHog SDK found` and stop. The wizard catches `[ABORT]` and terminates the run.

For each detected SDK, record the package name and installed version.

### b. Check latest published version

For each detected SDK, run `Bash` once to look up the latest published version:
- npm: `npm view <pkg> version`
- pip: `pip index versions <pkg>` (or `pip show <pkg>` if `index` is unavailable)
- gem: `gem search ^<pkg>$ -r`
- composer: `composer show <pkg> --latest --available --format=json`

## Resolution rules

`sdk-installed`:
- `pass`: at least one PostHog SDK in a manifest. Record SDK + version in `details`.

`sdk-up-to-date`:
- `pass`: at the latest minor.
- `suggestion`: patch-only behind.
- `warning`: more than one minor behind.
- `error`: one or more major versions behind.

## Resolve

Single call to `mcp__wizard-tools__audit_resolve_checks` with two updates and **nothing else**:

```
{
  "updates": [
    { "id": "sdk-installed",  "status": "pass",                          "details": "<sdk>@<version>" },
    { "id": "sdk-up-to-date", "status": "pass|suggestion|warning|error", "details": "installed <v>, latest <v>" }
  ]
}
```

Do not include `init-correct` in this call — it's resolved in Step 3.
