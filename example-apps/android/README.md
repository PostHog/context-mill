# PostHog Android example

This is an Android example demonstrating PostHog integration with product analytics and error tracking using Kotlin and Jetpack Compose.

This example uses the PostHog Android SDK (`posthog-android`) to provide automatic PostHog integration with built-in error tracking and simplified configuration.

## Features

- **Product Analytics**: Track user events and behaviors
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
│   │   │   │   ├── BurritoApp.kt              # Application class with PostHog initialization
│   │   │   │   ├── MainActivity.kt            # Main activity
│   │   │   │   ├── data/                      # User model + repository
│   │   │   │   ├── navigation/                # Compose navigation graph
│   │   │   │   ├── ui/
│   │   │   │   │   ├── screens/               # Home, Burrito, Profile screens
│   │   │   │   │   ├── components/            # Reusable UI components
│   │   │   │   │   └── theme/                 # Compose theme
│   │   │   │   └── viewmodel/
│   │   │   │       └── AuthViewModel.kt       # Login/logout with PostHog identify + events
│   │   │   ├── res/                           # Resources (layouts, strings, etc.)
│   │   │   └── AndroidManifest.xml            # App manifest
│   │   └── test/                              # Unit tests
│   └── build.gradle                           # App-level Gradle configuration
├── build.gradle                               # Project-level Gradle configuration
├── settings.gradle                            # Gradle settings
└── local.properties                           # Local configuration (gitignored)
```

## Key Integration Points

### Application Initialization (BurritoApp.kt)

PostHog is initialized in the `Application` class to ensure it's available throughout the app lifecycle:

```kotlin
import com.posthog.android.PostHogAndroid
import com.posthog.android.PostHogAndroidConfig

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
- `PostHogAndroid.setup()` is called once in `onCreate()` so PostHog is initialized as early as possible
- Configuration is loaded from `BuildConfig` (set in `build.gradle`)
- `errorTrackingConfig.autoCapture` captures uncaught exceptions automatically
- The Application class must be registered in `AndroidManifest.xml`

### User Identification (AuthViewModel.kt)

After setup, PostHog is used through the static `PostHog` object (`import com.posthog.PostHog`). Users are identified when they log in:

```kotlin
fun login(username: String) {
    viewModelScope.launch {
        val existingUser = repository.getUser(username)
        val user = existingUser ?: User(username = username, burritoConsiderations = 0)
        repository.saveUser(user)

        PostHog.identify(username)
        PostHog.capture(event = "user_logged_in")
    }
}

fun logout() {
    viewModelScope.launch {
        PostHog.capture("user_logged_out")
        PostHog.reset()
        repository.clearCurrentUser()
    }
}
```

**Key Points:**
- `PostHog.identify()` is called once when the user logs in or signs up
- The distinct id should be a unique identifier for the user
- `PostHog.reset()` on logout unlinks the device from the user

### Event Tracking (AuthViewModel.kt)

Custom events are tracked throughout the app:

```kotlin
fun incrementBurritoCount() {
    viewModelScope.launch {
        val user = _currentUser.value ?: return@launch
        val updatedUser = user.copy(burritoConsiderations = user.burritoConsiderations + 1)
        repository.saveUser(updatedUser)

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
- Events are captured with `PostHog.capture()`
- Event properties provide context about the event
- Person properties can be set alongside an event via the `userProperties` parameter of `capture()`
- Properties can be strings, numbers, booleans, or dates

### Error Tracking

Uncaught exceptions are captured automatically via `errorTrackingConfig.autoCapture = true` in the configuration above. Exceptions can also be captured manually:

```kotlin
try {
    performRiskyOperation()
} catch (e: Exception) {
    PostHog.captureException(e, mapOf(
        "context" to "burrito_consideration"
    ))
}
```

### Accessing PostHog in Components

After `PostHogAndroid.setup()`, PostHog is used anywhere through the static `PostHog` object:

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
        buildConfigField "String", "POSTHOG_PROJECT_TOKEN", "\"${project.findProperty("posthog.apiKey") ?: ""}\""
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
        buildConfigField "String", "POSTHOG_PROJECT_TOKEN", "\"${localProperties.getProperty("posthog.apiKey", "")}\""
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
