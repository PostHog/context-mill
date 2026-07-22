import 'package:flutter_test/flutter_test.dart';

import 'package:burrito_app/main.dart';

void main() {
  testWidgets('shows the login form on launch', (WidgetTester tester) async {
    await tester.pumpWidget(const BurritoApp());

    expect(find.text('Welcome to the Burrito App'), findsOneWidget);
    expect(find.text('Log in'), findsOneWidget);
  });
}
