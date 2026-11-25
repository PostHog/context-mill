---
title: posthog-node 6.x API notes
description: Which APIs 6.x has, for projects on the default major
---

# posthog-node 6.x API notes

Every 6.x release has these APIs, so no fallback applies:

- `captureException` takes the options form, `captureException(err, { distinctId, properties })`. The positional form belongs to 4.5.0 to 5.x.
- `enableExceptionAutocapture`, `setupExpressErrorHandler`, `captureExceptionImmediate`, `withContext`, and `setupExpressRequestContext` are all available.
- MCP analytics (`@posthog/mcp`) is available.
