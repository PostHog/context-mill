# Cloudflare Workers Runtime Reference

This project deploys to Cloudflare Workers. The following overrides apply to ALL server-side code. Client-side posthog-js running in the browser is unaffected.

## Environment Variables

Workers historically had no `process.env`, but since April 2025 (compatibility date `2025-04-01`+), `process.env` is populated automatically when using the `nodejs_compat` flag. You can also use `import { env } from 'cloudflare:workers'` to access bindings from anywhere, including top-level scope. `import.meta.env` remains build-time only (Vite static replacement). The canonical framework-specific patterns are:

| Framework | Server-side env access |
|-----------|----------------------|
| React Router 7 | `context.cloudflare.env.VAR_NAME` (in loaders, actions, middleware) |
| SvelteKit | `platform.env.VAR_NAME` (in hooks and server routes) |
| Nuxt | `process.env` works via `unenv` polyfill — but **only inside event handlers**, not at top-level. Prefer `useRuntimeConfig(event)` (pass `event` explicitly on CF) |
| Astro 5 | `Astro.locals.runtime.env.VAR_NAME` (in SSR pages and API routes) |
| Astro 6+ | `import { env } from 'cloudflare:workers'` (direct import; `Astro.locals.runtime` was removed) |
| Hono / raw Workers | `env.VAR_NAME` from the fetch handler's `env` parameter |

Define variables in `wrangler.toml` under `[vars]` (non-secret) or via `wrangler secret put` (secret). Do NOT use `VITE_PUBLIC_` prefixed names on the server — those are Vite build-time replacements for client code only.

## Node.js Compatibility

`posthog-node` ships a dedicated `workerd` export that avoids Node.js built-ins — it does NOT require `nodejs_compat` on its own. However, other dependencies in your project may need it. If you see missing-module errors at import time, add the compatibility flag to `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

## Request Lifecycle and Event Flushing

Workers isolates are stateless — they may be reused across requests on the same edge location, but have no guaranteed longevity. Configure `posthog-node` for immediate dispatch and non-blocking flush:

```typescript
const posthog = new PostHog(apiKey, {
  host,
  flushAt: 1,
  flushInterval: 0,
});

// ... capture events ...

// Flush without blocking the response
ctx.waitUntil(posthog.shutdown());
```

- Set `flushAt: 1` and `flushInterval: 0` — do NOT rely on batch defaults designed for long-running servers.
- Use `ctx.waitUntil(posthog.shutdown())` to flush after the response is sent. The `ctx` / `waitUntil` source depends on the framework:
  - React Router 7: `context.cloudflare.ctx.waitUntil()`
  - SvelteKit: `platform.ctx.waitUntil()`
  - Astro 5: `Astro.locals.runtime.ctx.waitUntil()`
  - Astro 6+: `Astro.locals.cfContext.waitUntil()`
  - Hono: `c.executionCtx.waitUntil()`
  - Raw Workers: `ctx.waitUntil()` (`ctx` IS the `ExecutionContext` directly)
- As a framework-agnostic alternative, you can `import { waitUntil } from 'cloudflare:workers'` and call it from anywhere.
- PostHog's `captureImmediate()` method returns a Promise that can be passed directly to `waitUntil()` for single-event capture without full shutdown.
- Prefer creating a new PostHog client per request. Workers may reuse globals across requests on the same isolate, but the shutdown/flush lifecycle makes per-request instantiation safer.
