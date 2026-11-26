---
title: posthog-node 4.x and 5.x API notes
description: Which posthog-node version adds each API, and the fallback below it
---

# posthog-node 4.x and 5.x API notes

When the installed version is below an API's minimum, use the fallback.

| API | Minimum | Below the minimum |
|---|---|---|
| `captureExceptionImmediate` | 5.2.1 (not in 4.x) | `captureException`, then `await flush()` |
| `withContext` | 5.15.0 | Pass `distinctId` explicitly on every `capture()` call (it is required on 4.x) |
| `setupExpressRequestContext` | 5.31.0 | `withContext` in your own Express middleware from 5.15.0; below that, pass `distinctId` on every `capture()` call |

`@posthog/mcp` and `@posthog/ai` work with posthog-node 5.x: install them and keep `posthog-node` on 5.x.

## API by major

- **4.5.0 to 5.x**: `captureException` is positional, `captureException(err, distinctId, additionalProperties)`.
- **6.x** (not this skill): `captureException(err, { distinctId, properties })`. Don't copy that options form from the latest docs onto 4.x or 5.x.
