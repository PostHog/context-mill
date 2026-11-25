---
title: posthog 1.x (Rust) crate name and features
description: Which crate 1.x uses, and the features it needs
---

# posthog 1.x (Rust) crate name and features

- New installs add the `posthog` crate (`cargo add posthog@1`, `use posthog::...`).
- `posthog-rs` 1.x is a forwarding crate. When a project already declares it, keep `posthog-rs` (`use posthog_rs::...`, `posthog_rs::mcp::instrument(...)`) and add features to `posthog-rs`, not a second `posthog` dependency.
- With `default-features = false`, 1.x has no TLS: add the `tls` feature (`features = ["error-tracking", "tls"]`).
- MCP analytics (`posthog::mcp`, `mcp` feature) is in every 1.x release.
