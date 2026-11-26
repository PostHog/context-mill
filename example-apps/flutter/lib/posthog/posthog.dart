import 'dart:developer' as developer;

import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

/// PostHog credentials embedded at build time via --dart-define:
///
/// ```bash
/// flutter run \
///   --dart-define=POSTHOG_PROJECT_TOKEN=your_posthog_project_token \
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

/// Sets up the PostHog Flutter SDK manually from Dart when configured.
///
/// Manual setup keeps all configuration in one place and is required for
/// session replay and surveys. Native auto-init is disabled with
/// `com.posthog.posthog.AUTO_INIT: false` in:
/// - android/app/src/main/AndroidManifest.xml
/// - ios/Runner/Info.plist
/// - macos/Runner/Info.plist
///
/// On Flutter Web the SDK is initialized by the posthog-js snippet in
/// web/index.html instead, because the native `setup()` call is a no-op there.
///
/// The [projectToken] and [host] parameters allow tests to pass values directly,
/// while production builds read from [PosthogEnv].
///
/// @see https://posthog.com/docs/libraries/flutter
Future<void> setupPostHog({
  String projectToken = PosthogEnv.projectToken,
  String host = PosthogEnv.host,
}) async {
  final trimmedToken = projectToken.trim();
  // Leave the SDK uninitialized when POSTHOG_PROJECT_TOKEN is missing or blank rather than initializing with an empty key.
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

  final trimmedHost =
      host.trim().isEmpty ? 'https://us.i.posthog.com' : host.trim();
  final config = PostHogConfig(trimmedToken);
  config.host = trimmedHost;

  // Verbose SDK logging in debug builds
  config.debug = kDebugMode;

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
