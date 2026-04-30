# Step 2 — Init correctness

This step resolves exactly one check: `init-correct`. Manifests and SDK versions are already resolved (Step 1). Identify and capture call sites belong to Step 3 — do not scan for them here.

## Status

Emit:

```
[STATUS] Locating PostHog initialization
```

## Action

If Step 1 installed an integration skill, **read its references first** to learn the canonical init location, file name, and shape for the framework. The skill lives at `.claude/skills/<integration-skill-id>/` — its `SKILL.md` and reference files are the source of truth for "what correct init looks like" for this framework. Don't guess from memory.

Then locate the project's actual init by issuing whatever `Grep` and `Read` calls are needed in parallel. Goal: confirm the init exists, runs in the right runtime for the framework, sources its token from an env variable, and (if applicable) sets an `api_host` for a reverse proxy. Also check `.env*` files to confirm the token env var is actually set.

If Step 1 didn't install an integration skill (no match), use general framework knowledge — but stay conservative on `init-correct` (prefer `warning` over `error` when the framework convention is unclear).

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
