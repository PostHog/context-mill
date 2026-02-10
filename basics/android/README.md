# PostHog Android example

This is an Android example demonstrating PostHog integration with product analytics, session replay, and error tracking using Kotlin and Jetpack Compose.

This example uses the PostHog Android SDK (`posthog-android`) to provide automatic PostHog integration with built-in error tracking, session replay, and simplified configuration.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Automatic error capture and crash reporting
- **User Authentication**: Demo login system with PostHog user identification
- **Event Tracking**: Examples of custom event tracking throughout the app

## Getting Started

### 1. Prerequisites

- Android Studio (latest stable version)
- Android SDK (API level 24 or higher)
- JDK 11 or higher
- Gradle 8.0 or higher
- A [PostHog account](https://app.posthog.com/signup)

### 2. Configure Environment Variables

The PostHog configuration is stored in `local.properties` (this file is gitignored):

```properties
# PostHog configuration
posthog.apiKey=your_posthog_project_api_key
posthog.host=https://us.i.posthog.com
```

Alternatively, you can configure PostHog in your `build.gradle` file:

```gradle
android {
    defaultConfig {
        buildConfigField "String", "POSTHOG_API_KEY", "\"your_posthog_project_api_key\""
        buildConfigField "String", "POSTHOG_HOST", "\"https://us.i.posthog.com\""
    }
}
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Build and Run

1. Open the project in Android Studio
2. Sync Gradle files
3. Run the app on an emulator or physical device

## Project Structure

```
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/example/posthog/
│   │   │   │   ├── BurritoApplication.kt      # Application class with PostHog initialization
│   │   │   │   ├── MainActivity.kt           # Main activity
│   │   │   │   ├── ui/
│   │   │   │   │   ├── screens/
│   │   │   │   │   │   ├── LoginScreen.kt     # Login screen with user identification
│   │   │   │   │   │   ├── BurritoScreen.kt   # Demo feature screen with event tracking
│   │   │   │   │   │   └── ProfileScreen.kt   # User profile with error tracking demo
│   │   │   │   │   └── components/            # Reusable UI components
│   │   │   │   └── utils/
│   │   │   │       └── PostHogHelper.kt       # PostHog utility functions
│   │   │   ├── res/                           # Resources (layouts, strings, etc.)
│   │   │   └── AndroidManifest.xml            # App manifest
│   │   └── test/                              # Unit tests
│   └── build.gradle                           # App-level Gradle configuration
├── build.gradle                               # Project-level Gradle configuration
├── settings.gradle                            # Gradle settings
└── local.properties                           # Local configuration (gitignored)
```

## Key Integration Points

### Application Initialization (BurritoApplication.kt)

PostHog is initialized in the `Application` class to ensure it's available throughout the app lifecycle:

```kotlin
class BurritoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        val posthogConfig = PostHogConfig(
            apiKey = BuildConfig.POSTHOG_API_KEY,
            host = BuildConfig.POSTHOG_HOST
        ).apply {
            // Enable session replay
            sessionReplay = true
            
            // Enable automatic exception capture
            captureApplicationLifecycleEvents = true
            captureDeepLinks = true
            captureScreenViews = true
        }
        
        PostHog.setup(this, posthogConfig)
    }
}
```

**Key Points:**
- PostHog is initialized in `onCreate()` to ensure it's initialized as early as possible
- Configuration is loaded from `BuildConfig` (set in `build.gradle`)
- Session replay, lifecycle events, and screen views are enabled
- The Application class must be registered in `AndroidManifest.xml`

### User Identification (LoginScreen.kt)

Users are identified when they log in:

```kotlin
val posthog = PostHog.getInstance()

fun handleLogin(username: String, password: String) {
    // Authenticate user
    val success = authenticateUser(username, password)
    
    if (success) {
        // Identify the user once on login/sign up
        posthog.identify(
            distinctId = username,
            properties = mapOf(
                "username" to username,
                "login_method" to "password"
            )
        )
        
        // Capture login event
        posthog.capture("user_logged_in", mapOf(
            "username" to username
        ))
    }
}
```

**Key Points:**
- `identify()` is called once when the user logs in or signs up
- User properties can be set during identification
- Events are captured using `capture()` with event names and properties
- The `distinctId` should be a unique identifier for the user

### Event Tracking (BurritoScreen.kt)

Custom events are tracked throughout the app:

```kotlin
val posthog = PostHog.getInstance()

fun handleBurritoConsideration() {
    // Track custom event
    posthog.capture("burrito_considered", mapOf(
        "total_considerations" to considerationCount,
        "username" to currentUser.username,
        "timestamp" to System.currentTimeMillis()
    ))
    
    // Update user properties
    posthog.setUserProperties(mapOf(
        "last_burrito_consideration" to System.currentTimeMillis(),
        "total_burrito_considerations" to considerationCount
    ))
}
```

**Key Points:**
- Events are captured with `capture()` method
- Event properties provide context about the event
- User properties can be updated with `setUserProperties()`
- Properties can be strings, numbers, booleans, or dates

### Error Tracking

Errors are captured automatically and can also be tracked manually:

**Automatic Error Capture:**
PostHog automatically captures uncaught exceptions when configured:

```kotlin
val posthogConfig = PostHogConfig(
    apiKey = BuildConfig.POSTHOG_API_KEY,
    host = BuildConfig.POSTHOG_HOST
).apply {
    // Automatic exception capture is enabled by default
    captureApplicationLifecycleEvents = true
}
```

**Manual Error Capture:**
```kotlin
val posthog = PostHog.getInstance()

try {
    // Risky operation
    performRiskyOperation()
} catch (e: Exception) {
    // Capture exception manually
    posthog.captureException(e, mapOf(
        "context" to "burrito_consideration",
        "user_id" to currentUser.id
    ))
}
```

### Screen View Tracking

Screen views are automatically tracked when `captureScreenViews` is enabled. You can also manually track screen views:

```kotlin
val posthog = PostHog.getInstance()

// Manual screen view tracking
posthog.screen("BurritoScreen", mapOf(
    "screen_category" to "features",
    "user_type" to "premium"
))
```

### Session Replay

Session replay is enabled in the PostHog configuration:

```kotlin
val posthogConfig = PostHogConfig(
    apiKey = BuildConfig.POSTHOG_API_KEY,
    host = BuildConfig.POSTHOG_HOST
).apply {
    sessionReplay = true
    sessionReplayConfig = SessionReplayConfig(
        maskAllInputs = false, // Set to true to mask all input fields
        maskAllText = false    // Set to true to mask all text
    )
}
```

### Accessing PostHog in Components

PostHog is accessed via the singleton instance:

```kotlin
val posthog = PostHog.getInstance()
posthog.capture("event_name", mapOf("property" to "value"))
```

The instance is available throughout your application after initialization.

## Gradle Configuration

### App-level build.gradle

```gradle
android {
    defaultConfig {
        // PostHog configuration
        buildConfigField "String", "POSTHOG_API_KEY", "\"${project.findProperty("posthog.apiKey") ?: ""}\""
        buildConfigField "String", "POSTHOG_HOST", "\"${project.findProperty("posthog.host") ?: "https://us.i.posthog.com"}\""
    }
}

dependencies {
    // PostHog Android SDK
    implementation 'com.posthog:posthog-android:3.+'
    
    // Other dependencies...
}
```

### Reading from local.properties

The `local.properties` file is automatically read by Gradle:

```gradle
def localProperties = new Properties()
localProperties.load(new FileInputStream(rootProject.file("local.properties")))

android {
    defaultConfig {
        buildConfigField "String", "POSTHOG_API_KEY", "\"${localProperties.getProperty("posthog.apiKey", "")}\""
        buildConfigField "String", "POSTHOG_HOST", "\"${localProperties.getProperty("posthog.host", "https://us.i.posthog.com")}\""
    }
}
```

## Best Practices

1. **Initialize Early**: Initialize PostHog in your `Application.onCreate()` method
2. **Identify Once**: Call `identify()` once when the user logs in or signs up
3. **Use Meaningful Event Names**: Use clear, descriptive event names (e.g., `user_logged_in` instead of `login`)
4. **Include Context**: Add relevant properties to events for better analysis
5. **Handle Errors Gracefully**: Don't let PostHog errors break your app
6. **Test in Development**: Use a separate PostHog project for development/testing
7. **Respect Privacy**: Be mindful of PII (Personally Identifiable Information) in events and properties

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Android Documentation](https://developer.android.com)
- [PostHog Android Integration Guide](https://posthog.com/docs/libraries/android)
- [PostHog Android SDK](https://github.com/PostHog/posthog-android)
