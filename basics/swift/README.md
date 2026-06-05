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

Open `BurritoConsiderationClientApp.swift` and replace the `<your-project-token>` placeholder in `PostHogEnv.fallback` with your project token from your [PostHog project settings](https://app.posthog.com/project/settings).

The PostHog project token is a **public client-side key** — it is designed to ship in the app binary — so hardcoding it is safe and is the recommended approach for iOS distribution.

**Optional dev override:** `PostHogEnv` reads `POSTHOG_PROJECT_TOKEN` / `POSTHOG_HOST` from the environment first and only falls back to the hardcoded values when they're absent. To point the app at a different project during local development, set them in the Xcode scheme (**Product > Scheme > Edit Scheme… > Run > Arguments > Environment Variables**).

> **Why a hardcoded fallback, not env-only:** Xcode scheme environment variables are injected only when launching from Xcode (debug/simulator). They are **not** present in Archive / Release builds (TestFlight, App Store). Relying on the env var alone — and crashing when it's missing — would crash production builds on launch.

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
// binary. An env var override is read first for local-dev convenience, but the
// hardcoded fallback is what ships (scheme env vars are absent in Archive builds).
enum PostHogEnv: String {
    case apiKey = "POSTHOG_PROJECT_TOKEN"
    case host = "POSTHOG_HOST"

    var fallback: String {
        switch self {
        case .apiKey: return "<your-project-token>"
        case .host: return "https://us.i.posthog.com"
        }
    }

    var value: String {
        ProcessInfo.processInfo.environment[rawValue] ?? fallback
    }
}

let config = PostHogConfig(apiKey: PostHogEnv.apiKey.value, host: PostHogEnv.host.value)
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
