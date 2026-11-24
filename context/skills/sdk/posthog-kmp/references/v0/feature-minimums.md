---
title: posthog-kmp 0.x constructors and constraints
description: Keep 0.x named-argument constructors and do not copy 1.0 DSL blocks
---

# posthog-kmp 0.x constructors and constraints

The bundled `references/kmp.md` page documents **posthog-kmp 1.x**. When a project declares `posthog-kmp` `0.x`, stay on `0.x` and never copy the 1.x builder DSL (`PostHogConfig("...") { ... }`) into a `0.x` project.

| Construct | 0.x syntax | 1.x syntax (do NOT use on 0.x) |
|---|---|---|
| `PostHogConfig` | `PostHogConfig(projectToken = "...", host = "...", sessionRecording = SessionRecordingConfig(...))` | `PostHogConfig("...") { sessionReplay { ... } }` |
| `CaptureOptions` | `CaptureOptions(groups = mapOf(...))` | `CaptureOptions { groups = mapOf(...) }` |
| `beforeSend` copy | `event.copy(properties = ...)` | `event.copy { properties = ... }` |
| `captureException` | Positional/named `additionalProperties` | Renamed to `properties` in 1.x |
