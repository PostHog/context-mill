import 'package:burrito_app/auth/auth_state.dart';
import 'package:burrito_app/screens/home_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/pump_app.dart';
import '../mocks.dart';

void main() {
  late FakePosthogPlatform posthog;

  setUp(() {
    posthog = installFakePosthog();
    AuthState.instance = AuthState();
  });

  Future<void> signIn(
    WidgetTester tester, {
    String username = 'maria',
    String password = 'secret',
  }) async {
    await tester.enterText(find.byType(TextField).at(0), username);
    await tester.enterText(find.byType(TextField).at(1), password);
    await tester.ensureVisible(find.text('Sign In'));
    await tester.tap(find.text('Sign In'));
    await tester.pump();
  }

  group('HomeScreen', () {
    testWidgets('shows the login form when logged out', (tester) async {
      await tester.pumpApp(const HomeScreen());

      expect(find.text('Welcome to Burrito Consideration App'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
      expect(find.text('Username:'), findsOneWidget);
      expect(find.text('Password:'), findsOneWidget);
    });

    testWidgets('rejects an empty form without touching PostHog', (
      tester,
    ) async {
      await tester.pumpApp(const HomeScreen());

      await tester.ensureVisible(find.text('Sign In'));
      await tester.tap(find.text('Sign In'));
      await tester.pump();

      expect(
        find.text('Please provide both username and password'),
        findsOneWidget,
      );
      expect(posthog.callOrder, isEmpty);
    });

    testWidgets('signing in identifies the user in PostHog', (tester) async {
      await tester.pumpApp(const HomeScreen());

      await signIn(tester, username: 'maria');

      expect(posthog.identifyCalls.single.userId, 'maria');
      expect(posthog.capturedEvents.single.eventName, 'user_logged_in');
      expect(find.text('Welcome back, maria!'), findsOneWidget);
    });
  });
}
