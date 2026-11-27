---
title: posthog_flutter 6.x requirements and APIs
description: Default 6.x requirements and APIs
---

# posthog_flutter 6.x requirements and APIs

- Requires Flutter 3.41.0+ on all platforms (`flutter pub add 'posthog_flutter:^6.0.0'`).
- On iOS and macOS, 6.x installs via Swift Package Manager only and requires Xcode 26+ with iOS 15.0+ / macOS 12.0+.
- Auto-init keys are `com.posthog.posthog.PROJECT_TOKEN` and `com.posthog.posthog.POSTHOG_HOST`. `getFeatureFlagResult` and `captureAi` are available.
