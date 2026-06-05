# PostHog Swift (iOS/macOS) example

This is a [SwiftUI](https://developer.apple.com/xcode/swiftui/) example demonstrating PostHog integration with product analytics, error tracking, and user identification. The app targets both iOS and macOS using `NavigationSplitView`.

## Features

- **Product analytics**: Track user events and behaviors
- **Error tracking**: Capture and track errors
- **User identification**: Associate events with authenticated users
- **Multi-platform**: Runs on iOS, iPadOS, macOS, and visionOS

## Getting started

### 1. Add the PostHog dependency

The Xcode project already includes the PostHog iOS SDK via Swift Package Manager. When you open the project, Xcode will resolve the package automatically.

To add it manually to a new project: File > Add Package Dependencies > enter `https://github.com/PostHog/posthog-ios`.

### 2. Set your PostHog project token

Open `BurritoConsiderationClientApp.swift` and replace the `<your-project-token>` placeholder in `posthogProjectToken` with your project token from your [PostHog project settings](https://app.posthog.com/project/settings).

The PostHog project token is a **public client-side key** — it is designed to ship in the app binary — so hardcoding it is safe and is the recommended approach for iOS distribution.

> **Don't rely on Xcode scheme environment variables as the only source.** Scheme environment variables are injected only when launching from Xcode (debug/simulator); they are **absent** in Archive / Release builds (TestFlight, App Store). Reading them is fine, but treat them as an optional override over a value that ships in the binary — never force-unwrap or `fatalError` on their absence, or production builds will crash on launch.

### 3. Build and run

Open `BurritoConsiderationClient.xcodeproj` in Xcode and run on an iOS Simulator or macOS.

## Project structure

```
BurritoConsiderationClient/
├── BurritoConsiderationClientApp.swift  # App entry point with PostHog initialization
├── ContentView.swift                    # NavigationSplitView with sidebar routing
├── UserState.swift                      # @Observable user state with PostHog identify
├── LoginView.swift                      # Login form
├── DashboardView.swift                  # Welcome screen with dashboard_viewed tracking
├── BurritoView.swift                    # Burrito consideration with event capture
├── ProfileView.swift                    # Profile with journey progress and error trigger
└── Assets.xcassets/                     # Asset catalog
```

## Key integration points

### PostHog initialization (BurritoConsiderationClientApp.swift)

```swift
import PostHog

// The project token is a public client-side key, so it's safe to ship in the
// binary. Replace the placeholder with your token from the PostHog project settings.
let config = PostHogConfig(apiKey: "<your-project-token>", host: "https://us.i.posthog.com")
config.captureApplicationLifecycleEvents = true
PostHogSDK.shared.setup(config)
```

### User identification (UserState.swift)

```swift
PostHogSDK.shared.identify(username, userProperties: [
    "username": username,
])
```

### Screen view tracking (DashboardView.swift, ProfileView.swift)

```swift
.onAppear {
    PostHogSDK.shared.capture("dashboard_viewed", properties: [
        "username": userState.username ?? "unknown",
    ])
}
```

### Event tracking (BurritoView.swift)

```swift
PostHogSDK.shared.capture("burrito_considered", properties: [
    "total_considerations": count,
    "username": username,
])
```

### Error tracking (ProfileView.swift)

```swift
PostHogSDK.shared.capture("test_error_triggered", properties: [
    "error_type": "test",
    "error_message": error.localizedDescription,
])
```

### User logout (UserState.swift)

```swift
PostHogSDK.shared.capture("user_logged_out")
PostHogSDK.shared.reset()
```

## Learn more

- [PostHog iOS SDK Documentation](https://posthog.com/docs/libraries/ios)
- [PostHog Documentation](https://posthog.com/docs)
- [SwiftUI Documentation](https://developer.apple.com/documentation/swiftui)
