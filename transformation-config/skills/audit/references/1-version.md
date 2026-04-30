# Step 1 — SDK installed + SDK up-to-date

This step is intentionally narrow. It runs **before any other project work**. Resolve exactly two checks: `sdk-installed` and `sdk-up-to-date`. **Do not** read source code, locate init sites, look at `.env*` files, or scan for identify/capture call sites in this step — that all belongs to later steps.

## TodoWrite

This is the **first** TodoWrite of the run. Call `TodoWrite` with `todos` set to the **array** below (not a string — pass the literal array value):

```
todos: [
  { content: "Setup",  status: "in_progress", activeForm: "Setting up audit" },
  { content: "Audit",  status: "pending",     activeForm: "Running audit" },
  { content: "Report", status: "pending",     activeForm: "Writing report" }
]
```

## Status

Emit:

```
[STATUS] Scanning manifests
[STATUS] Checking SDK version
```

## Action

### a. Find the PostHog SDK

`Glob` for the project's dependency manifests (`package.json`, `requirements.txt`, `pyproject.toml`, `Gemfile`, `composer.json`, `build.gradle`, `Podfile`, etc.) and read enough of them to identify which PostHog SDK the project uses, what version, and what framework it sits on top of.

If no PostHog SDK is anywhere in the project, emit `[ABORT] No PostHog SDK found` and stop. The wizard catches `[ABORT]` and terminates the run.

### b. Install the matching integration skill

Once you know the SDK + framework, install the matching integration skill so the rest of the audit has framework-specific install docs to reference instead of guessing:

1. Call `mcp__wizard-tools__load_skill_menu({ category: "integration" })` once to list available integration skill IDs.
2. Call `mcp__wizard-tools__install_skill({ skillId: "<id>" })` with the **single** ID that matches the framework you detected. Pick one — do not install multiple.

If no integration skill matches the framework, skip this step. Step 2 will fall back to general framework knowledge.

### c. Check latest published version

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

Do not include `init-correct` in this call — it's resolved in Step 2.
