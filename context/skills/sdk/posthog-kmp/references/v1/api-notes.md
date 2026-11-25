---
title: posthog-kmp 1.x builder DSL
description: Builder syntax and defaults in posthog-kmp 1.x
---

# posthog-kmp 1.x builder DSL

- Use builder blocks: `PostHogConfig("<token>") { host = "..."; sessionReplay { ... } }` and `CaptureOptions { ... }`.
- `apiKey` alias is removed (pass token as the first positional arg to `PostHogConfig`), `captureScreenViews` defaults to `true`, and `beforeSend` copies via `event.copy { ... }`.
