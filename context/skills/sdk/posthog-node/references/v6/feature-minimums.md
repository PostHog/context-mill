---
title: posthog-node 6.x feature availability
description: Which APIs 6.x has, for projects on the default major
---

# posthog-node 6.x feature availability

Every 6.x release meets the feature minimums of the older majors, so no fallback applies:

- `captureException` takes the options form, `captureException(err, { distinctId, properties })`. The positional form belongs to 4.5.0 to 5.x.
- `enableExceptionAutocapture`, `setupExpressErrorHandler`, `captureExceptionImmediate`, `withContext`, and `setupExpressRequestContext` are all available.
- MCP analytics (`@posthog/mcp`) is available.
