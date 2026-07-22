import 'package:flutter/material.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import 'posthog/posthog.dart';
import 'screens/burrito_screen.dart';
import 'screens/home_screen.dart';
import 'screens/profile_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await setupPostHog();
  runApp(const BurritoApp());
}

class BurritoApp extends StatelessWidget {
  const BurritoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Burrito App',
      // Match the web examples' look: system font stack on a light grey
      // page with #333 body text (see globals.css in the web examples).
      theme: ThemeData(
        colorSchemeSeed: AppColors.primary,
        scaffoldBackgroundColor: AppColors.background,
        textTheme: Typography.blackCupertino.apply(
          bodyColor: AppColors.text,
          displayColor: AppColors.text,
        ),
      ),
      // PosthogObserver captures a $screen event on every route change.
      // Routes must be named (like the `routes` map below) or the screen
      // views won't be recorded.
      // @see https://posthog.com/docs/libraries/flutter#capturing-screen-views
      navigatorObservers: [PosthogObserver()],
      initialRoute: HomeScreen.route,
      routes: {
        HomeScreen.route: (_) => const HomeScreen(),
        BurritoScreen.route: (_) => const BurritoScreen(),
        ProfileScreen.route: (_) => const ProfileScreen(),
      },
    );
  }
}
