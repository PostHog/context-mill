---
title: posthog (Python) 8.x API notes
description: Which APIs 8.x has, for projects on the default major
---

# posthog (Python) 8.x API notes

Every 8.x release has these APIs, so no fallback applies:

- `PosthogFlaskIntegration`, `PosthogASGIMiddleware`, the Django REST Framework exception handler, `PosthogContextMiddleware`, and `enable_exception_autocapture=True` are all available.
- `identify()` does not exist. Use `set(distinct_id=..., properties=...)` or `identify_context(...)` inside a context.
- `new_context`, `identify_context`, and `tag` are available at module level (`from posthog import ...`) and on the client.
- MCP analytics (`posthog.mcp`) is available.
