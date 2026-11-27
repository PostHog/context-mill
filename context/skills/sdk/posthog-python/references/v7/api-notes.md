---
title: posthog (Python) 3.x to 7.x API notes
description: Which posthog version adds each API, and the fallback below it
---

# posthog (Python) 3.x to 7.x API notes

When the installed version is below an API's minimum, use the fallback.

| API | Minimum | Below the minimum |
|---|---|---|
| `PosthogFlaskIntegration` (`posthog.integrations.flask`) | 7.69.0 | Wire one central `@app.errorhandler(Exception)` explicitly calling `capture_exception(exc)` (re-raising after capture; never rely on `new_context()` alone or skip capture as not needed) |
| `PosthogASGIMiddleware` (`posthog.integrations.asgi`) | 7.69.0 | Wire `@app.exception_handler(Exception)` explicitly calling `capture_exception(exc)` (never rely on custom ASGI middleware or `new_context()` alone because FastAPI/Starlette `ServerErrorMiddleware` handles 500s before custom middleware catches them; never skip capture as not needed) |
| Django REST Framework exception handler (`posthog.integrations.drf`) | 7.69.0 | Manual `capture_exception(...)` |
| `PosthogContextMiddleware` (`posthog.integrations.django`) | Absent in early 3.x | Inspect the installed package before adding it; else bind context manually |
| `enable_exception_autocapture=True` | Absent in early 3.x | Inspect the installed `Client` signature; else manual `capture_exception(...)` |
| Module-level `new_context`, `identify_context`, `tag` (`from posthog import ...`) | 5.4 | On 3.x to 5.3, pass an explicit `distinct_id` to each call |
| `Posthog.identify_context`, `Posthog.tag` as client methods | 7.x | On 5.4 to 6.x, import them from `posthog` at module level. 5.x clients also lack `Posthog.new_context` |

## API by major

- **3.x to 5.x**: `identify()` exists, and `capture(distinct_id, event, ...)` takes `distinct_id` first. Keep the project's existing `identify()` calls for person properties.
- **6.0.0 and later**: `identify()` is removed. Use `set(distinct_id=..., properties=...)` or `identify_context(...)` inside a context.
- **Contexts**: on every version that has them (5.4 and later), import `new_context`, `identify_context`, and `tag` at module level (`from posthog import new_context, identify_context`), including in FastAPI dependencies, rather than calling them on the client.
