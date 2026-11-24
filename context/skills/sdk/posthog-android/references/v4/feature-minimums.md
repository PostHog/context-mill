---
title: posthog-android 4.x requirements and APIs
description: Default 4.x APIs and requirements
---

# posthog-android 4.x requirements and APIs

- Supports Android 6.0 (API level 23) and newer (`com.posthog:posthog-android:4.+`).
- Use `PostHogAndroidConfig(projectToken = "<token>", host = ...)` (named options; `apiKey` removed).
- `getFeatureFlagResult`, `captureAi`, and `PostHogEventOptions` are available across 4.x.
