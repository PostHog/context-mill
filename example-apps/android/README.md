# PostHog Android example

This is an Android example demonstrating PostHog integration with product analytics, session replay, and error tracking using Kotlin and Jetpack Compose.

This example uses the PostHog Android SDK (`posthog-android`) to provide automatic PostHog integration with built-in error tracking, session replay, and simplified configuration.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Automatic error capture and crash reporting
- **User Authentication**: Demo login system with stable UUID user identification
- **Event Tracking**: Examples of custom event tracking throughout the app

## Getting Started

### 1. Prerequisites

- Android Studio (latest stable version)
- Android SDK (API level 24 or higher)
- JDK 11 or higher
- Gradle 8.0 or higher
- A [PostHog account](https://app.posthog.com/signup)

### 2. Configure Environment Variables

Copy `local.properties.example` to `local.properties` (gitignored) and set your PostHog project token:

```properties
# PostHog configuration
posthog.projectToken=your_posthog_project_token
posthog.host=https://us.i.posthog.com
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
│   │   │   │   ├── BurritoApp.kt              # BurritoApplication: conditional PostHog initialization
│   │   │   │   ├── MainActivity.kt            # Main activity
│   │   │   │   ├── data/                      # User model (UUID + username) and repository
│   │   │   │   ├── navigation/                # Navigation graph
│   │   │   │   ├── ui/
│   │   │   │   │   ├── screens/               # Home, Burrito, and Profile screens
│   │   │   │   │   ├── components/            # Reusable UI components
│   │   │   │   │   └── theme/
│   │   │   │   └── viewmodel/
│   │   │   │       └── AuthViewModel.kt       # Login, session restore, logout, and event capture
│   │   │   ├── res/                           # Resources (layouts, strings, etc.)
│   │   │   └── AndroidManifest.xml            # App manifest
│   │   └── test/                              # Unit tests
│   └── build.gradle.kts                       # App-level Gradle configuration
├── gradle/libs.versions.toml                  # Dependency versions, including posthog-android
├── build.gradle.kts                           # Project-level Gradle configuration
├── settings.gradle.kts                        # Gradle settings
└── local.properties.example                   # Local configuration template
```

## Key Integration Points

### Application Initialization (BurritoApp.kt)

PostHog is initialized in the `Application` class when `BuildConfig.POSTHOG_PROJECT_TOKEN` is configured. When missing or blank, the app skips `PostHogAndroid.setup` rather than initializing with an empty string, and logs an error in debug builds:

```kotlin
class BurritoApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        val token: String? = BuildConfig.POSTHOG_PROJECT_TOKEN?.trim()
        if (token.isNullOrBlank()) {
            if (BuildConfig.DEBUG) {
                Log.e(
                    "PostHog",
                    "posthog.projectToken variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once posthog.projectToken is configured"
                )
            }
            return
        }

        val config = PostHogAndroidConfig(
            projectToken = token,
            host = BuildConfig.POSTHOG_HOST,
        ).apply {
            debug = BuildConfig.DEBUG
            errorTrackingConfig.autoCapture = true
        }

        PostHogAndroid.setup(this, config)
    }
}
```

**Key Points:**
- PostHog is initialized in `onCreate()` as early as possible when a project token is present
- `BuildConfig.POSTHOG_PROJECT_TOKEN` emits `null` when unset in `local.properties` so unconfigured builds never pass `""` to `PostHogAndroidConfig`
- `PostHogAndroid.setup()` runs once, and subsequent calls go through the static `PostHog` object
- Application lifecycle events, deep links, and screen views are captured by default
- The Application class is registered in `AndroidManifest.xml`

### User Identification (AuthViewModel.kt)

Users are identified with a stable `UUID` (`user.id`) both when signing in and when restoring a persisted session on app launch, passing `username` in `userProperties`:

```kotlin
private fun loadCurrentUser() {
    viewModelScope.launch {
        val user = repository.getCurrentUser()
        _currentUser.value = user
        _isAuthenticated.value = user != null
        if (user != null) {
            PostHog.identify(
                distinctId = user.id,
                userProperties = mapOf("username" to user.username)
            )
        }
    }
}

fun login(username: String) {
    val trimmedUsername = username.trim()
    if (trimmedUsername.isEmpty()) return

    viewModelScope.launch {
        val existingUser = repository.getUser(trimmedUsername)
        val isNewUser = existingUser == null
        val user = existingUser ?: User(username = trimmedUsername, burritoConsiderations = 0)
        repository.saveUser(user)
        _currentUser.value = user
        _isAuthenticated.value = true

        PostHog.identify(
            distinctId = user.id,
            userProperties = mapOf("username" to user.username)
        )
        PostHog.capture(
            event = "user_logged_in",
            properties = mapOf(
                "login_method" to "username",
                "is_new_user" to isNewUser
            )
        )
    }
}

fun logout() {
    viewModelScope.launch {
        if (_currentUser.value == null) return@launch
        PostHog.capture("user_logged_out")
        PostHog.reset()
        repository.clearCurrentUser()
        _currentUser.value = null
        _isAuthenticated.value = false
    }
}
```

**Key Points:**
- Always pass a stable UUID or database ID as `distinctId`, never a username or email
- Put `username` in `userProperties` on `PostHog.identify()`, and re-identify when restoring a persisted session on app launch
- Capture `user_logged_out` before `PostHog.reset()`, and only call `reset()` when logging out of an authenticated session

### Event Tracking (AuthViewModel.kt)

Custom events carry non-PII context properties:

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
                "total_considerations" to updatedUser.burritoConsiderations
            )
        )
    }
}
```

### Error Tracking

PostHog captures uncaught exceptions when `errorTrackingConfig.autoCapture` is enabled, and supports manual exception capture:

```kotlin
try {
    performRiskyOperation()
} catch (e: Exception) {
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

Session replay can be enabled in the PostHog configuration once you confirm your project replay and masking settings:

```kotlin
val config = PostHogAndroidConfig(
    projectToken = token,
    host = BuildConfig.POSTHOG_HOST,
).apply {
    sessionReplay = true
    sessionReplayConfig.maskAllTextInputs = true
    sessionReplayConfig.maskAllImages = true
}
```

## Gradle Configuration

### Reading from local.properties (app/build.gradle.kts)

```kotlin
val rawPostHogToken = localProperties.getProperty("posthog.projectToken")?.trim()
val postHogTokenLiteral =
    if (rawPostHogToken.isNullOrEmpty()) "null" else "\"$rawPostHogToken\""
val rawPostHogHost = localProperties.getProperty("posthog.host")?.trim()
val postHogHost =
    if (rawPostHogHost.isNullOrEmpty()) "https://us.i.posthog.com" else rawPostHogHost

buildConfigField("String", "POSTHOG_PROJECT_TOKEN", postHogTokenLiteral)
buildConfigField("String", "POSTHOG_HOST", "\"$postHogHost\"")
```

## Best Practices

1. **Initialize Early**: Initialize PostHog in `Application.onCreate()` when a project token is configured
2. **Use Stable User IDs**: Identify users with a persisted UUID on login and session restore, keeping `username` in person properties
3. **Use Meaningful Event Names**: Use clear, descriptive event names like `user_logged_in` and `burrito_considered`
4. **Keep PII Out of Event Properties**: Never pass usernames or emails in `PostHog.capture()` properties
5. **Handle Missing Config Cleanly**: Emit `null` when `posthog.projectToken` is unset so debug builds log a clear error without initializing a broken client

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [Android Documentation](https://developer.android.com)
- [PostHog Android Integration Guide](https://posthog.com/docs/libraries/android)
- [PostHog Android SDK](https://github.com/PostHog/posthog-android)
