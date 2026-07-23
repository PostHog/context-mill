import 'package:flutter_test/flutter_test.dart';

import 'package:burrito_app/main.dart';

void main() {
  testWidgets('shows the login form on launch', (WidgetTester tester) async {
    await tester.pumpWidget(const BurritoApp());

    expect(find.text('Welcome to Burrito Consideration App'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Username:'), findsOneWidget);
    expect(find.text('Password:'), findsOneWidget);
  });
}
