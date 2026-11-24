---
title: posthog-node 4.x and 5.x feature minimums
description: Which posthog-node version adds each API, and the fallback below it
---

# posthog-node 4.x and 5.x feature minimums

Check the installed version first. When it is below a feature's minimum, use the fallback. Raise an open range only within the installed major; never move a hard pin or cross a major.

| Feature | Minimum | Below the minimum |
|---|---|---|
| `captureException`, `enableExceptionAutocapture`, `setupExpressErrorHandler` | 4.5.0 (absent in 4.0 to 4.4) | No exception capture: report the minimum |
| `captureExceptionImmediate` | 5.2.1 (not in 4.x) | `captureException`, then `await flush()` |
| `withContext` | 5.15.0 | Pass `distinctId` explicitly on every `capture()` call (it is required on 4.x) |
| `setupExpressRequestContext` | 5.31.0 | `withContext` in your own Express middleware from 5.15.0; below that, pass `distinctId` on every `capture()` call |
| MCP analytics (`@posthog/mcp`) | 5.0.0 | On 4.x, don't install it: keep the declaration and emit `[ABORT] posthog sdk upgrade required: posthog-node <current> (requires >=5.0.0)`; in the main wizard run, complete the `mcp-analytics` task as not needed with that reason. On 5.x, install only `@posthog/mcp` and keep `posthog-node` on 5.x |
| LLM analytics (`@posthog/ai`) | 5.0.0 | On 4.x, don't install it; report the minimum |

## API by major

- **4.5.0 to 5.x**: `captureException` is positional, `captureException(err, distinctId, additionalProperties)`.
- **6.x** (not this skill): `captureException(err, { distinctId, properties })`. Don't copy that options form from the latest docs onto 4.x or 5.x.
