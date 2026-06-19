---
next_step: 3-identification.md
---

# Step 2 — Init correctness

This step resolves two checks: `init-correct` and `init-not-duplicated`. Manifests and SDK versions are already resolved (Step 1). Identification call sites belong to Step 3 and event-capture call sites to Step 4 — do not scan for them here.

## Status

Emit:

```
[STATUS] Locating PostHog initialization
```

## Action

Locate every PostHog init site by issuing one `Grep` for `posthog\.init\(|new PostHog\(|posthog\.Posthog\(|Posthog\(` plus whatever `Read` calls are needed. Confirm at least one init exists, runs in the right runtime for the detected SDK + framework, and sources its token from an env variable (not hardcoded). Also check `.env*` files to confirm the token env var is actually set. Reverse-proxy / `api_host` configuration belongs to Step 4 — don't evaluate it here.

Use the detected SDK + framework from Step 1 to know what to look for: the canonical init filename, runtime, and shape vary by framework. If the host project already ships a PostHog integration skill, use that as the source of truth. Skills are typically under `.claude/skills/`; if that directory doesn't exist (some projects keep skills under `agents/skills/`, plain `skills/`, etc.), discover any candidates with one `Glob` pattern: `**/skills/**/SKILL.md`. Read the matching skill before judging.

When no integration skill is available, rely on general framework knowledge — and stay conservative on `init-correct` (prefer `warning` over `error` when the convention is unclear).

For `init-not-duplicated`, count the init sites the grep found and group them by runtime (browser vs. server vs. mobile). The check fires when more than one init site exists in the same runtime — the browser bundle running `posthog.init()` twice will race to stamp `$set_once` properties like `$initial_pathname` and `$initial_referrer`, corrupting attribution at scale. A browser init plus a server init is fine; two browser inits is not. Treat conditional inits inside an `if (typeof window === 'undefined')` / `if (typeof window !== 'undefined')` branch on the same code path as ONE logical site per runtime (only one branch executes).

## Resolution rules

`init-correct`:
- `pass`: at least one init present, env-sourced token, runtime-appropriate location.
- `error`: init missing, hardcoded token, or wrong runtime (e.g. server-only init for a browser-side framework).
- `warning`: init present but in a non-canonical location for the framework.

`init-not-duplicated`:
- `pass`: at most one init site per runtime.
- `warning`: two or more init sites in the same runtime that could plausibly both execute. Report the file:line of each and which runtime. The dual-init `$set_once` race corrupted attribution at scale at one multi-SDK SaaS customer (~165k blocked merges/day).
- `error`: two or more browser-runtime init sites confirmed to run on the same page (e.g. one in the root layout / provider, another in a child component that always mounts).

## Resolve

Single call to `mcp__wizard-tools__audit_resolve_checks` with two updates:

```
{
  "updates": [
    { "id": "init-correct",        "status": "pass|error|warning", "file": "<path:line>", "details": "..." },
    { "id": "init-not-duplicated", "status": "pass|warning|error", "file": "<path:line>", "details": "..." }
  ]
}
```
