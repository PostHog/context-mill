import 'package:burrito_app/auth/auth_state.dart';
import 'package:burrito_app/screens/burrito_screen.dart';
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

  Future<void> considerBurrito(WidgetTester tester) async {
    await tester.tap(find.text('I have considered the burrito potential'));
    await tester.pump();
  }

  group('BurritoScreen', () {
    testWidgets('considering a burrito captures an event with properties', (
      tester,
    ) async {
      await tester.pumpApp(const BurritoScreen());

      await considerBurrito(tester);

      final event = posthog.capturedEvents.single;
      expect(event.eventName, 'burrito_considered');
      expect(event.properties, containsPair('total_considerations', 1));
      expect(event.properties, containsPair('is_first_consideration', true));
      expect(find.text('Total considerations: 1'), findsOneWidget);
    });

    testWidgets('later considerations are not marked as the first', (
      tester,
    ) async {
      await tester.pumpApp(const BurritoScreen());

      await considerBurrito(tester);
      await considerBurrito(tester);

      final event = posthog.capturedEvents.last;
      expect(event.properties, containsPair('total_considerations', 2));
      expect(event.properties, containsPair('is_first_consideration', false));
    });
  });
}
