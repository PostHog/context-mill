import 'package:burrito_app/posthog/posthog.dart';
import 'package:flutter_test/flutter_test.dart';

import '../mocks.dart';

void main() {
  late FakePosthogPlatform posthog;

  setUp(() {
    posthog = installFakePosthog();
  });

  group('setupPostHog', () {
    test('does not initialize the SDK without a project token', () async {
      await setupPostHog(projectToken: '');

      expect(posthog.setupConfigs, isEmpty);
    });

    test('initializes the SDK with the project token and host', () async {
      await setupPostHog(
        projectToken: 'phc_test_token',
        host: 'https://eu.i.posthog.com',
      );

      final config = posthog.setupConfigs.single;
      expect(config.projectToken, 'phc_test_token');
      expect(config.host, 'https://eu.i.posthog.com');
    });

    test('enables error tracking for uncaught errors', () async {
      await setupPostHog(projectToken: 'phc_test_token');

      final config = posthog.setupConfigs.single;
      expect(config.errorTrackingConfig.captureFlutterErrors, isTrue);
      expect(
        config.errorTrackingConfig.capturePlatformDispatcherErrors,
        isTrue,
      );
      expect(
        config.errorTrackingConfig.inAppIncludes,
        contains('package:burrito_app'),
      );
    });
  });
}
