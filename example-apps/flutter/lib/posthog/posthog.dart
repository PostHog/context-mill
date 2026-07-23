import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

/// PostHog credentials embedded at build time via --dart-define:
///
/// ```bash
/// flutter run \
///   --dart-define=POSTHOG_PROJECT_TOKEN=phc_your_project_token_here \
///   --dart-define=POSTHOG_HOST=https://us.i.posthog.com
/// ```
///
/// Get your project token from your PostHog project settings
/// (https://app.posthog.com/settings/project).
class PosthogEnv {
  static const projectToken = String.fromEnvironment('POSTHOG_PROJECT_TOKEN');
  static const host = String.fromEnvironment(
    'POSTHOG_HOST',
    // Usually 'https://us.i.posthog.com' or 'https://eu.i.posthog.com'
    defaultValue: 'https://us.i.posthog.com',
  );
}

/// Sets up the PostHog Flutter SDK manually from Dart.
///
/// Manual setup keeps all configuration in one place and is required for
/// session replay and surveys. Native auto-init is disabled with
/// `com.posthog.posthog.AUTO_INIT: false` in:
/// - android/app/src/main/AndroidManifest.xml
/// - ios/Runner/Info.plist
/// - macos/Runner/Info.plist
///
/// On Flutter Web the SDK is initialized by the posthog-js snippet in
/// web/index.html instead — the native `setup()` call is a no-op there.
///
/// The [projectToken] and [host] parameters exist for tests; production code
/// uses the build-time values from [PosthogEnv].
///
/// @see https://posthog.com/docs/libraries/flutter
Future<void> setupPostHog({
  String projectToken = PosthogEnv.projectToken,
  String host = PosthogEnv.host,
}) async {
  if (projectToken.isEmpty) {
    debugPrint(
      'PostHog project token not configured. Analytics will be disabled. '
      'Run with --dart-define=POSTHOG_PROJECT_TOKEN=phc_... to enable it.',
    );
    return;
  }

  final config = PostHogConfig(projectToken);
  config.host = host;

  // Verbose SDK logging in debug builds
  config.debug = kDebugMode;

  // Application lifecycle events (Application Installed, Application Updated,
  // Application Opened, Application Backgrounded) are captured by default
  // (captureApplicationLifecycleEvents, enabled since 5.23.0).

  // Error tracking: capture uncaught Flutter framework and platform
  // dispatcher errors as $exception events. Handled errors can be captured
  // manually with Posthog().captureException() (see ProfileScreen).
  // @see https://posthog.com/docs/error-tracking
  config.errorTrackingConfig.captureFlutterErrors = true;
  config.errorTrackingConfig.capturePlatformDispatcherErrors = true;
  // Mark this app's stack frames as in-app in the error tracking UI
  config.errorTrackingConfig.inAppIncludes.add('package:burrito_app');

  await Posthog().setup(config);
}
