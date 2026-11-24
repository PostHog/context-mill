---
title: posthog (Python) 3.x to 7.x feature minimums
description: Which posthog version adds each API, and the fallback below it
---

# posthog (Python) 3.x to 7.x feature minimums

Check the installed version first. When it is below a feature's minimum, use the fallback. Raise an open range only within the installed major (`>=X.Y.Z,<M+1`); never move a hard pin or cross a major.

| Feature | Minimum | Below the minimum |
|---|---|---|
| `PosthogFlaskIntegration` (`posthog.integrations.flask`) | 7.69.0 | Keep an exact hard pin unchanged and wire one central `@app.errorhandler(Exception)` explicitly calling `capture_exception(exc)` (re-raising after capture; never rely on `new_context()` alone or skip capture as not needed) |
| `PosthogASGIMiddleware` (`posthog.integrations.asgi`) | 7.69.0 | Keep an exact hard pin unchanged, wire `@app.exception_handler(Exception)` explicitly calling `capture_exception(exc)` (never rely on custom ASGI middleware or `new_context()` alone because FastAPI/Starlette `ServerErrorMiddleware` handles 500s before custom middleware catches them; never skip capture as not needed) |
| Django REST Framework exception handler (`posthog.integrations.drf`) | 7.69.0 | Manual `capture_exception(...)` |
| `PosthogContextMiddleware` (`posthog.integrations.django`) | Absent in early 3.x | Inspect the installed package before adding it; else bind context manually |
| `enable_exception_autocapture=True` | Absent in early 3.x | Inspect the installed `Client` signature; else manual `capture_exception(...)` |
| Module-level `new_context`, `identify_context`, `tag` (`from posthog import ...`) | 5.4 | On 3.x to 5.3, pass an explicit `distinct_id` to each call |
| `Posthog.identify_context`, `Posthog.tag` as client methods | 7.x | On 5.4 to 6.x, import them from `posthog` at module level. 5.x clients also lack `Posthog.new_context` |
| Release linking (`POSTHOG_RELEASE_ID`) | 7.59.0 | On an open 7.x range, raise the floor to `>=7.59.0,<8`. On a pre-existing exact pin below 7.59.0 (such as `posthog==7.40.0`), keep `requirements.txt` and `pyproject.toml` unchanged even when the release-linking instructions say to raise pins, skip changing the dependency, and list `posthog>=7.59.0` as a manual follow-up |
| MCP analytics (`posthog.mcp`) | 7.62.0 | On an open 7.x range, raise the floor to `>=7.62.0,<8`. On a hard pin below 7.62.0 or a major below 7, keep the declaration and emit `[ABORT] posthog sdk upgrade required: posthog <current> (requires >=7.62.0)`; in the main wizard run, complete the `mcp-analytics` task as not needed with that reason |

## API by major

- **3.x to 5.x**: `identify()` exists, and `capture(distinct_id, event, ...)` takes `distinct_id` first. Keep the project's existing `identify()` calls for person properties.
- **6.0.0 and later**: `identify()` is removed. Use `set(distinct_id=..., properties=...)` or `identify_context(...)` inside a context.
- **7.x on a range below 7.69.0**: raise the floor to `>=7.69.0,<8` to use the framework integrations. On a hard pin below 7.69.0, keep the pin and use the fallback, even where a framework rule says to require 7.69.0 when you add an integration.
- **Contexts**: on every version that has them (5.4 and later), import `new_context`, `identify_context`, and `tag` at module level (`from posthog import new_context, identify_context`), including in FastAPI dependencies, rather than calling them on the client.
