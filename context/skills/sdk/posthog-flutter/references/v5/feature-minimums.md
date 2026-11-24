---
title: posthog_flutter 4.x and 5.x constraints and APIs
description: Keep 4.x/5.x pubspec constraints without upgrading to 6.x
---

# posthog_flutter 4.x and 5.x constraints and APIs

Keep the existing `posthog_flutter` constraint in `pubspec.yaml` and never run a bare `flutter pub add posthog_flutter` (`6.x` requires Flutter 3.41+, Xcode 26+, Swift Package Manager, and iOS 15+).

## Feature minimums inside 4.x and 5.x

Check the installed version in `pubspec.lock` first. When it is below a feature's minimum, use the fallback. Raise an open range only within the installed major; never move a hard pin or cross a major, so a 4.x project never gets these features.

| Feature | Minimum | Below the minimum |
|---|---|---|
| `captureException` (manual error capture) | 5.7.0 | No exception capture: report the minimum |
| `errorTrackingConfig` (exception autocapture) | 5.9.0 | Report the minimum |
| `onFeatureFlags` in `PostHogConfig` | 5.10.0 | No load callback: call `Posthog().getFeatureFlag()` or `isFeatureEnabled()` where the flag is used |
| `beforeSend` in `PostHogConfig` | 5.13.0 | Don't add it; report the minimum |
| `getFeatureFlagResult` | 5.14.0 | `getFeatureFlag()` and `getFeatureFlagPayload()` |
| `setPersonProperties` | 5.15.0 | Pass person properties to `identify()` |
| Surveys (`config.surveys`) | 5.1.0 on iOS, 5.4.0 on Android | Don't enable them; report the minimum |
| Swift Package Manager on iOS/macOS | 5.19.0 | CocoaPods only |

## Changes in 6.x

| Feature / API | 4.x / 5.x | 6.x change |
|---|---|---|
| Manifest / Info.plist token key | `com.posthog.posthog.API_KEY` | Renamed to `com.posthog.posthog.PROJECT_TOKEN` |
| `getFeatureFlagPayload()`, `onFeatureFlags` in `PostHogConfig` | `getFeatureFlagPayload()` on every version, `onFeatureFlags` from 5.10.0 | Removed / replaced with `getFeatureFlagResult` |
| `beforeSend` callbacks | From 5.13.0, may be async | Must be synchronous on 6.x |
| iOS/macOS dependency setup | CocoaPods (`platform :ios, '13.0'`), or SPM from 5.19.0 | SPM only (`iOS 15.0+`, `macOS 12.0+`, Xcode 26) |
| `captureAi(...)` | Absent (use `capture` with `$ai_*`) | Available in 6.x |
