---
title: posthog-android 3.x constraints and APIs
description: Keep 3.x Gradle dependencies and 3.x constructor/callback shapes
---

# posthog-android 3.x constraints and APIs

Keep `com.posthog:posthog-android` on 3.x and never add `com.posthog:posthog` 7.x or `posthog-server` >= 2.26.0 (either pulls `posthog-android` 4.x transitively and causes runtime bytecode errors).

| Feature / API | 3.x | 4.x change |
|---|---|---|
| Config token parameter | `PostHogAndroidConfig(apiKey = ...)` (pre-3.72) or `projectToken` | `apiKey` removed |
| Flag payloads & callbacks | `getFeatureFlagPayload()`, `PostHogConfig.onFeatureFlags` | Use `getFeatureFlagResult()`, callback takes result param |
| Replay screenshot toggle | `sessionReplayConfig.screenshot` supported | Removed (`debouncerDelayMs` -> `throttleDelayMs`) |
| `captureAi(...)` / `PostHogEventOptions` | Absent in 3.x | Available in 4.x |
