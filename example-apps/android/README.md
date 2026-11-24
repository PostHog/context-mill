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
posthog.projectToken=your_posthog_project_token
posthog.host=https://us.i.posthog.com
```

Alternatively, you can configure PostHog in your `build.gradle` file:

```gradle
android {
    defaultConfig {
        buildConfigField "String", "POSTHOG_PROJECT_TOKEN", "\"your_posthog_project_token\""
        buildConfigField "String", "POSTHOG_HOST", "\"https://us.i.posthog.com\""
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
│   │   │   │   ├── BurritoApp.kt              # BurritoApplication: PostHog initialization
│   │   │   │   ├── MainActivity.kt            # Main activity
│   │   │   │   ├── data/                      # User model and repository
│   │   │   │   ├── navigation/                # Navigation graph
│   │   │   │   ├── ui/
│   │   │   │   │   ├── screens/               # Home, Burrito and Profile screens
│   │   │   │   │   ├── components/            # Reusable UI components
│   │   │   │   │   └── theme/
│   │   │   │   └── viewmodel/
│   │   │   │       └── AuthViewModel.kt       # Login, logout and event capture
│   │   │   ├── res/                           # Resources (layouts, strings, etc.)
│   │   │   └── AndroidManifest.xml            # App manifest
│   │   └── test/                              # Unit tests
│   └── build.gradle.kts                       # App-level Gradle configuration
├── gradle/libs.versions.toml                  # Dependency versions, including posthog-android
├── build.gradle.kts                           # Project-level Gradle configuration
├── settings.gradle.kts                        # Gradle settings
└── local.properties                           # Local configuration (gitignored)
```

## Key Integration Points

### Application Initialization (BurritoApp.kt)

PostHog is initialized in the `Application` class to ensure it's available throughout the app lifecycle:

```kotlin
import android.app.Application
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

class BurritoApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        // Initialize PostHog early in Application lifecycle
        val config = PostHogAndroidConfig(
            projectToken = BuildConfig.POSTHOG_PROJECT_TOKEN,
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
- `PostHogAndroidConfig` takes `projectToken` and `host`. Configuration is loaded from `BuildConfig` (set in `app/build.gradle.kts`)
- `PostHogAndroid.setup()` runs once. After it, every call goes through the static `PostHog` object
- Application lifecycle events, deep links and screen views are captured by default (`captureApplicationLifecycleEvents`, `captureDeepLinks`, `captureScreenViews`)
- The Application class must be registered in `AndroidManifest.xml`

### User Identification (AuthViewModel.kt)

Users are identified when they log in:

```kotlin
import com.posthog.PostHog

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

fun logout() {
    viewModelScope.launch {
        PostHog.capture("user_logged_out")
        PostHog.reset()
        repository.clearCurrentUser()
        _currentUser.value = null
        _isAuthenticated.value = false
    }
}
```

**Key Points:**
- `PostHog.identify()` is called once when the user logs in or signs up
- Person properties can be set during identification with `userProperties`, for example `PostHog.identify(distinctId = username, userProperties = mapOf("plan" to "pro"))`
- `PostHog.reset()` on logout unlinks future events from the user
- The `distinctId` should be a unique identifier for the user

### Event Tracking (AuthViewModel.kt)

Custom events are tracked throughout the app:

```kotlin
fun incrementBurritoCount() {
    viewModelScope.launch {
        val user = _currentUser.value ?: return@launch
        val updatedUser = user.copy(burritoConsiderations = user.burritoConsiderations + 1)
        repository.saveUser(updatedUser)
        _currentUser.value = updatedUser

        PostHog.capture(
            event = "burrito_considered",
            properties = mapOf(
                "total_considerations" to updatedUser.burritoConsiderations,
                "username" to updatedUser.username
            )
        )
    }
}
```

**Key Points:**
- Events are captured with `PostHog.capture()`, which takes `event` and optional `properties`
- Event properties provide context about the event
- Person properties can be updated with `PostHog.setPersonProperties(userPropertiesToSet = mapOf(...))`
- Properties can be strings, numbers, booleans, or dates

### Error Tracking

Errors are captured automatically and can also be tracked manually:

**Automatic Error Capture:**
PostHog captures uncaught exceptions when `errorTrackingConfig.autoCapture` is on. It's off by default:

```kotlin
val config = PostHogAndroidConfig(
    projectToken = BuildConfig.POSTHOG_PROJECT_TOKEN,
    host = BuildConfig.POSTHOG_HOST,
).apply {
    errorTrackingConfig.autoCapture = true
}
```

**Manual Error Capture:**
```kotlin
try {
    // Risky operation
    performRiskyOperation()
} catch (e: Exception) {
    // Capture exception manually
    PostHog.captureException(
        e,
        properties = mapOf("context" to "burrito_consideration")
    )
}
```

### Screen View Tracking

Screen views are tracked automatically while `captureScreenViews` is on (the default). You can also track screen views manually:

```kotlin
PostHog.screen(
    screenTitle = "BurritoScreen",
    properties = mapOf("screen_category" to "features")
)
```

### Session Replay

Session replay is enabled in the PostHog configuration:

```kotlin
val config = PostHogAndroidConfig(
    projectToken = BuildConfig.POSTHOG_PROJECT_TOKEN,
    host = BuildConfig.POSTHOG_HOST,
).apply {
    sessionReplay = true
    sessionReplayConfig.maskAllTextInputs = true // Mask text input fields (default)
    sessionReplayConfig.maskAllImages = true     // Mask images (default)
}
```

### Accessing PostHog in Components

After `PostHogAndroid.setup()`, call PostHog through the static `PostHog` object from anywhere in the app. There is no instance to fetch:

```kotlin
import com.posthog.PostHog

PostHog.capture(event = "event_name", properties = mapOf("property" to "value"))
```

## Gradle Configuration

### App-level build.gradle

```gradle
android {
    defaultConfig {
        // PostHog configuration
        buildConfigField "String", "POSTHOG_PROJECT_TOKEN", "\"${project.findProperty("posthog.projectToken") ?: ""}\""
        buildConfigField "String", "POSTHOG_HOST", "\"${project.findProperty("posthog.host") ?: "https://us.i.posthog.com"}\""
    }
}

dependencies {
    // PostHog Android SDK
    implementation 'com.posthog:posthog-android:4.+'
    
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
        buildConfigField "String", "POSTHOG_PROJECT_TOKEN", "\"${localProperties.getProperty("posthog.projectToken", "")}\""
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
