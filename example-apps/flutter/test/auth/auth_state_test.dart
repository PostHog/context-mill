import 'package:burrito_app/auth/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

import '../mocks.dart';

void main() {
  late FakePosthogPlatform posthog;

  setUp(() {
    posthog = installFakePosthog();
    AuthState.instance = AuthState();
  });

  group('AuthState', () {
    group('logIn', () {
      test('identifies the user with person properties', () async {
        await AuthState.instance.logIn('maria');

        final call = posthog.identifyCalls.single;
        expect(call.userId, 'maria');
        expect(call.userProperties, {'username': 'maria'});
        expect(
          call.userPropertiesSetOnce,
          containsPair('first_login_date', isA<String>()),
        );
      });

      test('captures the login event after identifying', () async {
        await AuthState.instance.logIn('maria');

        final event = posthog.capturedEvents.single;
        expect(event.eventName, 'user_logged_in');
        expect(event.properties, containsPair('login_method', 'demo_form'));
        // Identify first, so the login event is attributed to the user.
        expect(posthog.callOrder, ['identify', 'capture']);
      });
    });

    group('logOut', () {
      setUp(() async {
        await AuthState.instance.logIn('maria');
        // Discard the PostHog calls made by the logIn arrange step, so
        // tests only see what the action under test produced.
        posthog.clear();
      });

      test('captures the logout event before resetting identity', () async {
        await AuthState.instance.logOut();

        final event = posthog.capturedEvents.single;
        expect(event.eventName, 'user_logged_out');
        expect(posthog.resetCallCount, 1);
        // Capture first, so the logout event is still attributed to the
        // user; reset() clears the identity for the next user.
        expect(posthog.callOrder, ['capture', 'reset']);
      });
    });
  });
}
