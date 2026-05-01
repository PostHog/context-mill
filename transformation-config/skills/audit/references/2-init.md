# Step 2 — Init correctness

This step resolves exactly one check: `init-correct`. Manifests and SDK versions are already resolved (Step 1). Identify and capture call sites belong to Step 3 — do not scan for them here.

## Status

Emit:

```
[STATUS] Locating PostHog initialization
```

## Action

Locate the project's PostHog init by issuing whatever `Grep` and `Read` calls are needed in parallel. Confirm the init exists, runs in the right runtime for the detected SDK + framework, sources its token from an env variable (not hardcoded), and (if applicable) sets an `api_host` for a reverse proxy. Also check `.env*` files to confirm the token env var is actually set.

Use the detected SDK + framework from Step 1 to know what to look for: the canonical init filename, runtime, and shape vary by framework. If the host project already ships a PostHog integration skill, use that as the source of truth. Skills are typically under `.claude/skills/`; if that directory doesn't exist (some projects keep skills under `agents/skills/`, plain `skills/`, etc.), discover any candidates with one `Glob` pattern: `**/skills/**/SKILL.md`. Read the matching skill before judging.

When no integration skill is available, rely on general framework knowledge — and stay conservative on `init-correct` (prefer `warning` over `error` when the convention is unclear).

## Resolution rules

`init-correct`:
- `pass`: init present, env-sourced token, runtime-appropriate location.
- `error`: init missing, hardcoded token, or wrong runtime (e.g. server-only init for a browser-side framework).
- `warning`: init present but in a non-canonical location for the framework.

## Resolve

Single call to `mcp__wizard-tools__audit_resolve_checks` with one update:

```
{
  "updates": [
    { "id": "init-correct", "status": "pass|error|warning", "file": "<path:line>", "details": "..." }
  ]
}
```
