import 'package:flutter/material.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../auth/auth_state.dart';

/// User profile screen with an error tracking demo.
///
/// @see https://posthog.com/docs/error-tracking
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  static const route = '/profile';

  Future<void> _triggerTestError(BuildContext context) async {
    try {
      throw StateError('Test error for PostHog error tracking');
    } catch (error, stackTrace) {
      // Capture handled exceptions manually. Uncaught Flutter errors are
      // captured automatically via errorTrackingConfig (see setupPostHog).
      await Posthog().captureException(
        error: error,
        stackTrace: stackTrace,
        properties: {'source': 'profile_test_button'},
      );
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Test error sent to PostHog')),
      );
    }
  }

  Future<void> _logOut(BuildContext context) async {
    final navigator = Navigator.of(context);
    await AuthState.instance.logOut();
    navigator.popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListenableBuilder(
        listenable: AuthState.instance,
        builder: (context, _) {
          final auth = AuthState.instance;
          if (!auth.isLoggedIn) {
            return const Center(child: Text('Not logged in.'));
          }
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      auth.username!,
                      style: Theme.of(context).textTheme.headlineSmall,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Burritos considered: ${auth.burritoConsiderations}',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    OutlinedButton(
                      onPressed: () => _triggerTestError(context),
                      child: const Text('Trigger test error'),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: () => _logOut(context),
                      child: const Text('Log out'),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
