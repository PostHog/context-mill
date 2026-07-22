# PostHog Flutter example

A [Flutter](https://flutter.dev/) example app demonstrating PostHog integration with product analytics, user identification, screen tracking, and error tracking across Android, iOS, Web, and macOS — the platforms the [posthog_flutter](https://pub.dev/packages/posthog_flutter) SDK supports.

## Features

- **Product analytics**: Track user events and behaviors with `Posthog().capture()`
- **Screen tracking**: Automatic `$screen` events for named routes via `PosthogObserver`
- **Error tracking**: Manual `captureException()` plus autocapture of uncaught Flutter errors
- **User authentication**: Demo login flow with PostHog `identify()`/`reset()`
- **Manual SDK setup**: Single Dart-side configuration with native auto-init disabled (required for session replay and surveys)

## Prerequisites

1. **Flutter SDK** — follow the [install guide](https://docs.flutter.dev/get-started/install) for your OS, then verify with:
   ```bash
   flutter doctor
   ```
2. **For iOS/macOS**: a Mac with Xcode and [CocoaPods](https://guides.cocoapods.org/using/getting-started.html) (`brew install cocoapods`)
3. **For Android**: Android Studio with an emulator or a connected device
4. **For Web**: Chrome

## Getting started

### 1. Install dependencies

```bash
flutter pub get
```

### 2. Configure your PostHog project token

Get your project token from your [PostHog project settings](https://app.posthog.com/settings/project).

For **Android, iOS, and macOS**, the token is embedded at build time via `--dart-define` (no file to edit):

```bash
flutter run \
  --dart-define=POSTHOG_PROJECT_TOKEN=phc_your_project_token_here \
  --dart-define=POSTHOG_HOST=https://us.i.posthog.com
```

`POSTHOG_HOST` is optional and defaults to `https://us.i.posthog.com` (use `https://eu.i.posthog.com` for EU Cloud).

For **Web**, edit `web/index.html` and replace `phc_your_project_token_here` in the posthog-js snippet — Flutter Web is initialized by that snippet, not by the Dart config.

> **Note:** The app still runs without a token — analytics are simply disabled (a warning is logged).

### 3. Run per platform

```bash
flutter devices                      # list available targets

flutter run --dart-define=POSTHOG_PROJECT_TOKEN=phc_...              # default device
flutter run -d chrome                                                 # Web (token comes from web/index.html)
flutter run -d macos --dart-define=POSTHOG_PROJECT_TOKEN=phc_...     # macOS
```

For iOS, install pods first (first time only): `cd ios && pod install && cd ..`

## Project structure

```
lib/
├── main.dart                    # Entry point: PostHog setup, MaterialApp with
│                                # named routes + PosthogObserver
├── posthog/
│   └── posthog.dart             # PostHog configuration (manual setup)
├── auth/
│   └── auth_state.dart          # Fake auth with identify()/reset()
└── screens/
    ├── home_screen.dart         # Home/login screen
    ├── burrito_screen.dart      # Demo feature screen with event capture
    └── profile_screen.dart      # Profile with error tracking demo

android/                         # AUTO_INIT disabled in AndroidManifest.xml
ios/                             # AUTO_INIT disabled in Runner/Info.plist; Podfile pins iOS 13+
web/                             # posthog-js snippet in index.html
macos/                           # AUTO_INIT disabled in Runner/Info.plist;
                                 # network.client entitlement for the app sandbox
```

## Key integration points

### Manual SDK setup (lib/posthog/posthog.dart)

PostHog is configured once in Dart. Manual setup (instead of the native auto-init path) is required for session replay and surveys, so the native layers disable auto-init with `com.posthog.posthog.AUTO_INIT: false`:

```dart
final config = PostHogConfig(PosthogEnv.projectToken);
config.host = PosthogEnv.host;
config.debug = kDebugMode;
config.errorTrackingConfig.captureFlutterErrors = true;
config.errorTrackingConfig.capturePlatformDispatcherErrors = true;
await Posthog().setup(config);
```

On Flutter Web, `setup()` is a no-op — the posthog-js snippet in `web/index.html` initializes the SDK instead.

### Screen tracking (lib/main.dart)

`PosthogObserver` captures a `$screen` event on every route change. Routes must be named or they won't be recorded:

```dart
MaterialApp(
  navigatorObservers: [PosthogObserver()],
  routes: {
    '/': (_) => const HomeScreen(),
    '/burrito': (_) => const BurritoScreen(),
    '/profile': (_) => const ProfileScreen(),
  },
)
```

### User identification (lib/auth/auth_state.dart)

Identify users as soon as they log in; person data goes in `userProperties` (`$set`) / `userPropertiesSetOnce` (`$set_once`), not event properties. Call `reset()` on logout:

```dart
await Posthog().identify(
  userId: username,
  userProperties: {'username': username},
  userPropertiesSetOnce: {'first_login_date': DateTime.now().toIso8601String()},
);

// on logout
await Posthog().reset();
```

### Event capture (lib/screens/burrito_screen.dart)

Capture custom events with properties. We recommend a `[object] [verb]` format for event names:

```dart
await Posthog().capture(
  eventName: 'burrito_considered',
  properties: {
    'total_considerations': total,
    'is_first_consideration': total == 1,
  },
);
```

### Error tracking (lib/screens/profile_screen.dart)

Uncaught Flutter errors are captured automatically via `errorTrackingConfig`. Handled errors can be captured manually:

```dart
try {
  throw StateError('Test error for PostHog error tracking');
} catch (error, stackTrace) {
  await Posthog().captureException(
    error: error,
    stackTrace: stackTrace,
    properties: {'source': 'profile_test_button'},
  );
}
```

### Application lifecycle events

`Application Installed`, `Application Updated`, `Application Opened`, and `Application Backgrounded` are captured automatically (`captureApplicationLifecycleEvents` is enabled by default).

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Flutter integration](https://posthog.com/docs/libraries/flutter)
- [PostHog error tracking](https://posthog.com/docs/error-tracking)
- [Flutter documentation](https://docs.flutter.dev/)
