import 'package:burrito_app/auth/auth_state.dart';
import 'package:burrito_app/screens/profile_screen.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/pump_app.dart';
import '../mocks.dart';

void main() {
  late FakePosthogPlatform posthog;

  setUp(() async {
    posthog = installFakePosthog();
    AuthState.instance = AuthState();
    await AuthState.instance.logIn('maria');
    // Discard the PostHog calls made by the logIn arrange step, so tests
    // only see what the action under test produced.
    posthog.clear();
  });

  group('ProfileScreen', () {
    testWidgets('captures a handled exception with its stack trace', (
      tester,
    ) async {
      await tester.pumpApp(const ProfileScreen());

      await tester.tap(find.text('Trigger Test Error (for PostHog)'));
      await tester.pump();

      final captured = posthog.capturedExceptions.single;
      expect(
        captured.error,
        isA<StateError>().having(
          (error) => error.message,
          'message',
          'Test error for PostHog error tracking',
        ),
      );
      expect(captured.stackTrace, isNotNull);
      expect(
        captured.properties,
        containsPair('source', 'profile_test_button'),
      );
      expect(find.text('Error captured and sent to PostHog!'), findsOneWidget);
    });
  });
}
