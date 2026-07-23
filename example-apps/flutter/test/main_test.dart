import 'package:burrito_app/auth/auth_state.dart';
import 'package:burrito_app/main.dart';
import 'package:burrito_app/screens/burrito_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'mocks.dart';

void main() {
  late FakePosthogPlatform posthog;

  setUp(() {
    posthog = installFakePosthog();
    AuthState.instance = AuthState();
  });

  group('BurritoApp', () {
    testWidgets('captures a screen view for every named route change', (
      tester,
    ) async {
      await tester.pumpWidget(const BurritoApp());

      // PosthogObserver reports the initial route as root ('/').
      expect(posthog.screenNames, ["root ('/')"]);

      await tester.enterText(find.byType(TextField).at(0), 'maria');
      await tester.enterText(find.byType(TextField).at(1), 'secret');
      await tester.ensureVisible(find.text('Sign In'));
      await tester.tap(find.text('Sign In'));
      await tester.pump();

      await tester.tap(find.text('Burrito Consideration'));
      await tester.pumpAndSettle();

      expect(posthog.screenNames, ["root ('/')", BurritoScreen.route]);
    });
  });
}
