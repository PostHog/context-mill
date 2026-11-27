import 'package:burrito_app/auth/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

import '../mocks.dart';

final _uuidV4Pattern = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

void main() {
  late FakePosthogPlatform posthog;

  setUp(() {
    posthog = installFakePosthog();
    AuthState.instance = AuthState();
  });

  group('AuthState', () {
    group('logIn', () {
      test('skips blank usernames without touching PostHog', () async {
        await AuthState.instance.logIn('   ');

        expect(AuthState.instance.isLoggedIn, isFalse);
        expect(posthog.callOrder, isEmpty);
      });

      test('identifies the user with a stable UUID and person properties', () async {
        await AuthState.instance.logIn('maria');

        final call = posthog.identifyCalls.single;
        expect(call.userId, matches(_uuidV4Pattern));
        expect(call.userId, isNot('maria'));
        expect(call.userProperties, {'username': 'maria'});
        expect(
          call.userPropertiesSetOnce,
          containsPair('first_login_date', isA<String>()),
        );

        final firstUserId = call.userId;
        await AuthState.instance.logOut();
        posthog.clear();
        await AuthState.instance.logIn('maria');
        expect(posthog.identifyCalls.single.userId, firstUserId);
      });

      test('captures the login event after identifying', () async {
        await AuthState.instance.logIn('maria');

        final event = posthog.capturedEvents.single;
        expect(event.eventName, 'user_logged_in');
        expect(event.properties, containsPair('login_method', 'demo_form'));
        expect(event.properties?.containsKey('username'), isFalse);
        // Identify first so the login event is attributed to the user.
        expect(posthog.callOrder, ['identify', 'capture']);
      });
    });

    group('logOut', () {
      setUp(() async {
        await AuthState.instance.logIn('maria');
        // Discard the PostHog calls made by the logIn arrange step so
        // tests only see what the action under test produced.
        posthog.clear();
      });

      test('captures the logout event before resetting identity', () async {
        await AuthState.instance.logOut();

        final event = posthog.capturedEvents.single;
        expect(event.eventName, 'user_logged_out');
        expect(posthog.resetCallCount, 1);
        // Capture first so the logout event is still attributed to the
        // user, then reset() clears the identity for the next user.
        expect(posthog.callOrder, ['capture', 'reset']);
      });
    });
  });
}
