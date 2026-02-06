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

### 2. Configure environment variables

Set your PostHog API key and host as environment variables in the Xcode scheme:

1. In Xcode, go to **Product > Scheme > Edit Scheme…**
2. Select **Run** in the sidebar
3. Go to the **Arguments** tab
4. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `POSTHOG_API_KEY` | Your PostHog project API key |
| `POSTHOG_HOST` | `https://us.i.posthog.com` |

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

The app reads these via `ProcessInfo.processInfo.environment` and will crash with a clear message if they're missing.

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

guard let POSTHOG_API_KEY = ProcessInfo.processInfo.environment["POSTHOG_API_KEY"],
      let POSTHOG_HOST = ProcessInfo.processInfo.environment["POSTHOG_HOST"] else {
    fatalError("Set POSTHOG_API_KEY and POSTHOG_HOST in the Xcode scheme environment variables.")
}

let config = PostHogConfig(apiKey: POSTHOG_API_KEY, host: POSTHOG_HOST)
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
