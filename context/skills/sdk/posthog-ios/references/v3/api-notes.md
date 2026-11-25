---
title: posthog-ios 3.x constraints and APIs
description: What 3.x supports, CocoaPods retention, and 4.x-only features
---

# posthog-ios 3.x constraints and APIs

Keep the existing `posthog-ios` 3.x declaration (Swift Package Manager `3.x` or CocoaPods `pod 'PostHog'`). Never raise a 3.x dependency to 4.x or add SPM `posthog-ios` alongside an existing `Podfile` `pod 'PostHog'` entry (`posthog-ios` 4.x is SPM-only and requires Xcode 26 and iOS 15 / macOS 12).

| Feature / API | 3.x | 4.x only |
|---|---|---|
| CocoaPods (`pod 'PostHog'`) | Supported (keep existing Podfile) | SPM only |
| `reloadFeatureFlags { }` closure / `PostHogConfig.maxRetries` | Present in 3.x | Changed/removed in 4.x |
| `captureAi(...)` and `PostHogEventOptions` | Absent in 3.x (`capture(...)` instead) | Available |
| Package traits (`PostHog` vs optional traits) | Single `PostHog` product | Traits available in 4.x |
