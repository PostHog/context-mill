---
title: posthog-rs 0.x crate name and feature minimums
description: Which crate 0.x uses, and the minimum of each feature
---

# posthog-rs 0.x crate name and feature minimums

The 0.x line ships as the `posthog-rs` crate (`use posthog_rs::...`). Keep it; never switch a 0.x project to the `posthog` 1.x crate. Cargo treats each `0.y` minor as breaking, so ask before raising `0.28` to `0.29`.

| Feature | Minimum | Below the minimum |
|---|---|---|
| Sync `capture` / `capture_batch` on the async client (the default `async-client` feature) | 0.14.0 | On 0.3 to 0.13 they are `async fn ... -> Result<(), Error>`: write `client.capture(event).await` and handle the `Result`. Without `.await` the event is never sent, and the compiler only warns |
| `flush()`, `shutdown()` | 0.14.0 | Absent: each awaited `capture` sends the event itself, so don't call them |
| `capture_exception` | 0.12.0 | No exception capture: report the minimum |
| MCP analytics (`posthog_rs::mcp`, `mcp` feature) | 0.29.0 | When an open range already spans 0.29 (`">=0.28,<1"`), raise its floor to `>=0.29,<1` in `Cargo.toml` and run `cargo update -p posthog-rs`. On an exact pin (`"=0.28.0"`) or a `0.28` caret or tilde requirement, keep it and emit `[ABORT] posthog sdk upgrade required: posthog-rs <current> (requires >=0.29.0)`; in the main wizard run, complete the `mcp-analytics` task as not needed with that reason |
| `tls` feature | Doesn't exist on 0.x | Don't add it; it breaks the build |

With `posthog-rs`, call `posthog_rs::client(...)` and `posthog_rs::mcp::instrument(...)`, not the `posthog::` paths the latest docs show.
