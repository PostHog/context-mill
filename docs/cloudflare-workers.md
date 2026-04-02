# Cloudflare Workers Runtime Reference

This project deploys to Cloudflare Workers. The following overrides apply to ALL server-side code. Client-side posthog-js running in the browser is unaffected.

## Environment Variables

Workers have NO `process.env` and NO runtime `import.meta.env`. Environment variables are bound to the execution context and accessed through the framework adapter:

| Framework | Server-side env access |
|-----------|----------------------|
| React Router 7 | `context.cloudflare.env.VAR_NAME` (in loaders, actions, middleware) |
| SvelteKit | `platform.env.VAR_NAME` (in hooks and server routes) |
| Nuxt | `process.env` works via `unenv` polyfill — but prefer `useRuntimeConfig()` |
| Astro | `Astro.locals.runtime.env.VAR_NAME` (in SSR pages and API routes) |
| Hono / raw Workers | `env.VAR_NAME` from the fetch handler's `env` parameter |

Define variables in `wrangler.toml` under `[vars]` (non-secret) or via `wrangler secret put` (secret). Do NOT use `VITE_PUBLIC_` prefixed names on the server — those are Vite build-time replacements for client code only.

## Node.js Compatibility

`posthog-node` requires Node.js built-ins (`buffer`, `events`, `stream`, etc.). Add the compatibility flag to `wrangler.toml`:

```toml
compatibility_flags = ["nodejs_compat"]
```

Without this, the SDK will crash at import time with missing module errors.

## Request Lifecycle and Event Flushing

Workers isolates are short-lived. Configure `posthog-node` for immediate dispatch and non-blocking flush:

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
  - SvelteKit: `platform.context.waitUntil()`
  - Astro: `Astro.locals.runtime.ctx.waitUntil()`
  - Hono / raw Workers: `ctx.executionCtx.waitUntil()` or `c.executionCtx.waitUntil()`
- Create a new PostHog client per request — do NOT use a singleton. Workers may reuse globals across requests on the same isolate, but the shutdown/flush lifecycle makes per-request instantiation safer.
