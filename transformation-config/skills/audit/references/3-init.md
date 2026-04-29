# Step 3 — Init correctness

**Read ONLY this file.** Do not read any other reference file until this one tells you to.

This step resolves exactly one check: `init-correct`. Manifests and SDK versions are already resolved (Step 2). Identify and capture call sites belong to Step 4 — do not scan for them here.

## Status

Emit:

```
[STATUS] Locating PostHog initialization
```

## Action — fan out reads in parallel

Issue these tool calls **all in a single message** so they run concurrently:

1. **One `Grep`** for the init pattern: `posthog\.init\(|new PostHog\(|<PostHogProvider`.
2. **One `Read`** for `.env`, `.env.local`, `.env.production` (issue all three Reads in the same message — missing files just return errors, that's fine).
3. **One `Read`** for the framework's main config by exact name: `next.config.js`, `next.config.ts`, `next.config.mjs`, `vite.config.ts`, `nuxt.config.ts`, `astro.config.mjs`, `svelte.config.js`, `vue.config.js`, etc. — issue every plausible name in parallel and ignore not-found errors.

When the Grep returns, issue **one more `Read`** for the first matching init file per runtime. That's the only sequential read in this step — everything else fans out in parallel.

### Verify

From the parallel reads, check:
- The init exists in the right place for the framework (e.g. Next.js 15.3+ uses `instrumentation-client.ts`).
- The project token is sourced from an env variable, **not hardcoded**.
- The `api_host` (or proxy) is set if the project uses a reverse proxy.

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

---

**Upon completion, continue with:** [4-runtime.md](4-runtime.md)
