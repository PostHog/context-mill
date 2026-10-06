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
posthog.apiKey=your_posthog_project_token
posthog.host=https://us.i.posthog.com
```

Alternatively, you can configure PostHog in your `app/build.gradle.kts` file:

```kotlin
android {
    defaultConfig {
        buildConfigField("String", "POSTHOG_PROJECT_TOKEN", "\"your_posthog_project_token\"")
        buildConfigField("String", "POSTHOG_HOST", "\"https://us.i.posthog.com\"")
    }
}
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

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
│   │   │   │   ├── BurritoApp.kt              # Application class with PostHog initialization
│   │   │   │   ├── MainActivity.kt            # Main activity
│   │   │   │   ├── data/
│   │   │   │   │   ├── User.kt                # User model
│   │   │   │   │   └── UserRepository.kt      # User storage in SharedPreferences
│   │   │   │   ├── navigation/
│   │   │   │   │   └── NavGraph.kt            # Navigation routes
│   │   │   │   ├── ui/
│   │   │   │   │   ├── screens/
│   │   │   │   │   │   ├── HomeScreen.kt      # Home screen with login form
│   │   │   │   │   │   ├── BurritoScreen.kt   # Demo feature screen with event tracking
│   │   │   │   │   │   └── ProfileScreen.kt   # User profile with error tracking demo
│   │   │   │   │   ├── components/            # Reusable UI components
│   │   │   │   │   └── theme/                 # Compose theme
│   │   │   │   └── viewmodel/
│   │   │   │       └── AuthViewModel.kt       # Login, logout, and user identification
│   │   │   ├── res/                           # Resources (layouts, strings, etc.)
│   │   │   └── AndroidManifest.xml            # App manifest
│   │   ├── test/                              # Unit tests
│   │   └── androidTest/                       # Instrumented tests
│   └── build.gradle.kts                       # App-level Gradle configuration
├── gradle/
│   └── libs.versions.toml                     # Dependency versions
├── build.gradle.kts                           # Project-level Gradle configuration
├── settings.gradle.kts                        # Gradle settings
└── local.properties.example                   # Template for local.properties (gitignored)
```

## Key Integration Points

### Application Initialization (BurritoApp.kt)

PostHog is initialized in the `Application` class to ensure it's available throughout the app lifecycle:

```kotlin
class BurritoApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Initialize PostHog early in Application lifecycle
        val config = PostHogAndroidConfig(
            apiKey = BuildConfig.POSTHOG_PROJECT_TOKEN,
            host = BuildConfig.POSTHOG_HOST,
        ).apply {
            debug = true
            errorTrackingConfig.autoCapture = true
        }

        PostHogAndroid.setup(this, config)
    }
}
```

**Key Points:**
- PostHog is initialized in `onCreate()` to ensure it's initialized as early as possible
- Configuration is loaded from `BuildConfig` (set in `app/build.gradle.kts`)
- Debug logging and automatic error capture are enabled
- The Application class must be registered in `AndroidManifest.xml`

### User Identification (AuthViewModel.kt)

Users are identified when they log in:

```kotlin
fun login(username: String) {
    viewModelScope.launch {
        val existingUser = repository.getUser(username)
        val user = existingUser ?: User(username = username, burritoConsiderations = 0)
        repository.saveUser(user)
        _currentUser.value = user
        _isAuthenticated.value = true

        PostHog.identify(username)
        PostHog.capture(event = "user_logged_in")
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
    apiKey = BuildConfig.POSTHOG_PROJECT_TOKEN,
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
    apiKey = BuildConfig.POSTHOG_PROJECT_TOKEN,
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

### App-level build.gradle.kts

```kotlin
android {
    defaultConfig {
        // PostHog configuration
        buildConfigField(
            "String",
            "POSTHOG_PROJECT_TOKEN",
            "\"${localProperties.getProperty("posthog.apiKey", "")}\""
        )
        buildConfigField(
            "String",
            "POSTHOG_HOST",
            "\"${localProperties.getProperty("posthog.host", "https://us.i.posthog.com")}\""
        )
    }
}

dependencies {
    // PostHog Android SDK, version set in gradle/libs.versions.toml
    implementation(libs.posthog.android)

    // Other dependencies...
}
```

### Reading from local.properties

`app/build.gradle.kts` loads `local.properties` when the file exists. Copy `local.properties.example` to `local.properties` to create it:

```kotlin
val localProperties = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        load(localPropertiesFile.inputStream())
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
