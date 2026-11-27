---
title: posthog-rs 0.x crate name and API notes
description: Which crate 0.x uses, and which version adds each API
---

# posthog-rs 0.x crate name and API notes

The 0.x line ships as the `posthog-rs` crate (`use posthog_rs::...`). Keep it; never switch a 0.x project to the `posthog` 1.x crate.

| API | Minimum | Below the minimum |
|---|---|---|
| Sync `capture` / `capture_batch` on the async client (the default `async-client` feature) | 0.14.0 | On 0.3 to 0.13 they are `async fn ... -> Result<(), Error>`: write `client.capture(event).await` and handle the `Result`. Without `.await` the event is never sent, and the compiler only warns |
| `flush()`, `shutdown()` | 0.14.0 | Absent: each awaited `capture` sends the event itself, so don't call them |
| `tls` feature | Doesn't exist on 0.x | Don't add it; it breaks the build |

With `posthog-rs`, call `posthog_rs::client(...)` and `posthog_rs::mcp::instrument(...)`, not the `posthog::` paths the latest docs show.
