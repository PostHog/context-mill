# PostHog Flutter example

A [Flutter](https://flutter.dev/) example app demonstrating PostHog integration with product analytics, user identification, screen tracking, and error tracking across Android, iOS, Web, and macOS, the platforms the [posthog_flutter](https://pub.dev/packages/posthog_flutter) SDK supports.

## Features

- **Product analytics**: Track user events and behaviors with `Posthog().capture()`
- **Screen tracking**: Automatic `$screen` events for named routes via `PosthogObserver`
- **Error tracking**: Manual `captureException()` plus autocapture of uncaught Flutter errors
- **User authentication**: Demo login flow with stable UUIDv4 `identify()` and `reset()`
- **Manual SDK setup**: Dart-side configuration with native auto-init disabled (required for session replay and surveys)

**Flutter Web initializes separately.** `Posthog().setup()` is a no-op on web, so
an app that ships a `web/` target needs the posthog-js snippet in `web/index.html`
as well, since a Dart-side setup alone leaves web builds capturing nothing. See
`web/index.html` in this example.

## Prerequisites

1. **Flutter SDK 3.41+** (3.44+ enables Swift Package Manager by default). Follow the [install guide](https://docs.flutter.dev/get-started/install) for your OS, then verify with:
   ```bash
   flutter doctor
   ```
2. **For iOS and macOS**: a Mac with Xcode 26+ (`posthog_flutter` 6.x installs via Swift Package Manager only and has no CocoaPods podspec)
3. **For Android**: Android Studio with an emulator or a connected device
4. **For Web**: Chrome

## Getting started

### 1. Regenerate icons and install dependencies

```bash
flutter create --platforms=android,ios,web,macos .
flutter pub get
```

Binary launcher and app icons are not committed. The `flutter create` step regenerates them without overwriting committed configs.

### 2. Configure your PostHog project token

Get your project token from your [PostHog project settings](https://app.posthog.com/settings/project).

For **Android, iOS, and macOS**, pass the token at build time via `--dart-define`:

```bash
flutter run \
  --dart-define=POSTHOG_PROJECT_TOKEN=your_posthog_project_token \
  --dart-define=POSTHOG_HOST=https://us.i.posthog.com
```

`POSTHOG_HOST` is optional and defaults to `https://us.i.posthog.com` (use `https://eu.i.posthog.com` for EU Cloud).

For **Web**, edit `web/index.html` and replace `undefined` on `posthogProjectToken` with your `"phc_..."` project token in the posthog-js snippet. Never pass a placeholder string to `posthog.init`.

> **Note:** When no token is configured, `setupPostHog()` and `web/index.html` skip SDK initialization and log an error in debug or localhost builds.

### 3. Run per platform

```bash
flutter devices

flutter run --dart-define=POSTHOG_PROJECT_TOKEN=phc_...
flutter run -d chrome
flutter run -d macos --dart-define=POSTHOG_PROJECT_TOKEN=phc_...
```

## Project structure

```
lib/
├── main.dart                    # Entry point: PostHog setup, MaterialApp with
│                                # named routes + PosthogObserver
├── posthog/
│   └── posthog.dart             # PostHog configuration (manual setup)
├── auth/
│   └── auth_state.dart          # Demo auth with UUIDv4 identify() and reset()
└── screens/
    ├── home_screen.dart         # Home and login screen
    ├── burrito_screen.dart      # Demo feature screen with event capture
    └── profile_screen.dart      # Profile with error tracking demo

test/
├── mocks.dart                   # FakePosthogPlatform: records identify, capture,
│                                # screen, and captureException calls for assertions
├── posthog/                     # SDK setup config tests
├── auth/                        # identify() and reset() lifecycle tests
└── screens/                     # Event capture + error tracking widget tests

android/                         # AUTO_INIT disabled in AndroidManifest.xml
ios/                             # AUTO_INIT disabled in Runner/Info.plist (iOS 15+, SwiftPM)
web/                             # posthog-js snippet in index.html
macos/                           # AUTO_INIT disabled in Runner/Info.plist (macOS 12+, SwiftPM)
```

## Key integration points

### Manual SDK setup (lib/posthog/posthog.dart)

PostHog is configured once in Dart when `POSTHOG_PROJECT_TOKEN` is non-empty. When missing or blank, `setupPostHog()` skips `Posthog().setup(config)` and logs an error in `kDebugMode`:

```dart
final trimmedToken = projectToken.trim();
if (trimmedToken.isEmpty) {
  if (kDebugMode) {
    developer.log(
      'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
      name: 'PostHog',
      level: 1000,
    );
  }
  return;
}

final config = PostHogConfig(trimmedToken);
config.host = trimmedHost;
config.debug = kDebugMode;
config.errorTrackingConfig.captureFlutterErrors = true;
config.errorTrackingConfig.capturePlatformDispatcherErrors = true;
await Posthog().setup(config);
```

On Flutter Web, `setup()` is a no-op, and the posthog-js snippet in `web/index.html` initializes the SDK when `posthogProjectToken` is configured.

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

Identify users with a stable UUID (`resolvedUserId`), never a username or email. Put person data in `userProperties` (`$set`) and `userPropertiesSetOnce` (`$set_once`), not event properties, and call `reset()` when logging out of an authenticated session:

```dart
await Posthog().identify(
  userId: resolvedUserId,
  userProperties: {'username': trimmedUsername},
  userPropertiesSetOnce: {'first_login_date': DateTime.now().toIso8601String()},
);

await Posthog().capture(
  eventName: 'user_logged_in',
  properties: {
    'login_method': 'demo_form',
    'is_new_user': isNewUser,
  },
);

// On logout from an authenticated session, capture before reset
await Posthog().capture(eventName: 'user_logged_out');
await Posthog().reset();
```

### Event capture (lib/screens/burrito_screen.dart)

Capture custom events with non-PII properties:

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

## Reverse proxy

On the web build, ad blockers often drop requests sent to PostHog's own domain. Set `POSTHOG_HOST` (and the `api_host` in `web/index.html`) to a reverse proxy to keep those events, for example PostHog's [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy.md). The iOS and Android builds aren't affected by browser ad blockers, so they can keep the default host.

## Testing

```bash
flutter test
```

The tests verify the PostHog integration without a network or a device. `test/mocks.dart` installs a fake `PosthogFlutterPlatformInterface` that records every `identify`, `capture`, `screen`, `reset`, and `captureException` call so tests assert on what would be sent to PostHog. The fake extends the platform interface rather than implementing it because `PlatformInterface.verifyToken` rejects generated mocks.

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog Flutter integration](https://posthog.com/docs/libraries/flutter)
- [PostHog error tracking](https://posthog.com/docs/error-tracking)
- [Flutter documentation](https://docs.flutter.dev/)
