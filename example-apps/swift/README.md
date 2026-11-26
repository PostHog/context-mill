# PostHog Swift (iOS and macOS) example

This is a [SwiftUI](https://developer.apple.com/xcode/swiftui/) example demonstrating PostHog integration with product analytics, screen tracking, error tracking, and user identification. The app targets both iOS and macOS using `NavigationSplitView`.

## Features

- **Product analytics**: Track user events and behaviors
- **Screen tracking**: Track SwiftUI screens with `.postHogScreenView(...)`
- **Error tracking**: Capture uncaught crashes automatically and report handled errors via `captureException`
- **User identification**: Associate events with a persisted UUID on login and session restore
- **Multi-platform**: Runs on iOS, iPadOS, macOS, and visionOS

## Getting started

### 1. Add the PostHog dependency

The Xcode project already includes the PostHog iOS SDK via Swift Package Manager. When you open the project, Xcode resolves the package automatically.

To add it manually to a new project: File > Add Package Dependencies > enter `https://github.com/PostHog/posthog-ios`.

### 2. Set your PostHog project token

Open `BurritoConsiderationClient/BurritoConsiderationClientApp.swift` and set `posthogProjectToken` to your `"phc_..."` project token from your [PostHog project settings](https://app.posthog.com/project/settings).

The PostHog project token is a **public client-side key** designed to ship in the app binary, so setting it directly in code is safe and is the recommended approach for iOS distribution. Until configured, `posthogProjectToken` stays `nil` so unconfigured builds log a debug error and skip `PostHogSDK.shared.setup` rather than initializing with a placeholder string.

> **Don't rely on Xcode scheme environment variables as the only source.** Scheme environment variables are injected only when launching from Xcode (debug and simulator), and they are **absent** in Archive and Release builds (TestFlight, App Store). Treat `ProcessInfo.processInfo.environment["POSTHOG_PROJECT_TOKEN"]` only as an optional local override over a value that ships in the binary, and never force-unwrap or `fatalError` when unset.

### 3. Build and run

Open `BurritoConsiderationClient.xcodeproj` in Xcode and run on an iOS Simulator or macOS.

## Project structure

```
BurritoConsiderationClient/
├── BurritoConsiderationClientApp.swift  # App entry point with conditional PostHog setup
├── ContentView.swift                    # NavigationSplitView with sidebar routing
├── UserState.swift                      # @Observable user state with UUID persistence and identify
├── LoginView.swift                      # Login form
├── DashboardView.swift                  # Welcome screen with .postHogScreenView("Dashboard")
├── BurritoView.swift                    # Burrito consideration with event capture
├── ProfileView.swift                    # Profile with journey progress and captureException
└── Assets.xcassets/                     # Asset catalog
```

## Key integration points

### PostHog initialization (BurritoConsiderationClientApp.swift)

```swift
import OSLog
import PostHog
import SwiftUI

// Set your "phc_..." project token here so it ships in the app binary per iOS best practice.
// Leave this nil until configured rather than passing a placeholder string to PostHogConfig.
private let posthogProjectToken: String? = nil
private let posthogHost = "https://us.i.posthog.com"

if let token = configuredToken, !token.isEmpty {
    let config = PostHogConfig(projectToken: token, host: host)
    config.captureApplicationLifecycleEvents = true
    config.errorTrackingConfig.autoCapture = true
    #if DEBUG
    config.debug = true
    #endif
    PostHogSDK.shared.setup(config)
} else {
    #if DEBUG
    Logger(subsystem: Bundle.main.bundleIdentifier ?? "BurritoConsiderationClient", category: "PostHog")
        .error("posthogProjectToken variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once posthogProjectToken is configured")
    #endif
}
```

### User identification (UserState.swift)

Identify with a stable `UUID` both on login and when restoring a persisted session from `UserDefaults`, keeping `username` in `userProperties`:

```swift
PostHogSDK.shared.identify(record.id, userProperties: [
    "username": record.username,
])

PostHogSDK.shared.capture("user_logged_in", properties: [
    "login_method": "username",
    "is_new_user": isNewUser,
])
```

### Screen view tracking (DashboardView.swift, BurritoView.swift, ProfileView.swift)

```swift
.postHogScreenView("Dashboard")
```

### Event tracking (BurritoView.swift)

```swift
PostHogSDK.shared.capture("burrito_considered", properties: [
    "total_considerations": count,
])
```

### Error tracking (ProfileView.swift)

```swift
PostHogSDK.shared.captureException(error)
```

### User logout (UserState.swift)

```swift
guard isLoggedIn else { return }
PostHogSDK.shared.capture("user_logged_out")
PostHogSDK.shared.reset()
```

## Learn more

- [PostHog iOS SDK Documentation](https://posthog.com/docs/libraries/ios)
- [PostHog Documentation](https://posthog.com/docs)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
