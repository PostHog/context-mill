import 'package:flutter/material.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../auth/auth_state.dart';

/// Burrito Consideration Screen.
///
/// Demonstrates PostHog event capture with custom properties. Each time the
/// user considers a burrito, an event is captured.
///
/// @see https://posthog.com/docs/libraries/flutter#capturing-events
class BurritoScreen extends StatelessWidget {
  const BurritoScreen({super.key});

  static const route = '/burrito';

  Future<void> _considerBurrito() async {
    final total = AuthState.instance.incrementBurritoConsiderations();

    // Capture a custom event with properties. We recommend a
    // [object] [verb] format for event names. Person data (like the
    // username) belongs in identify(), not in event properties.
    await Posthog().capture(
      eventName: 'burrito_considered',
      properties: {
        'total_considerations': total,
        'is_first_consideration': total == 1,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Burrito Consideration Zone')),
      body: ListenableBuilder(
        listenable: AuthState.instance,
        builder: (context, _) {
          final auth = AuthState.instance;
          if (!auth.isLoggedIn) {
            return const Center(child: Text('Log in to consider burritos.'));
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
                    const Text(
                      'Take a moment to truly consider the potential of '
                      'burritos.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: _considerBurrito,
                      child: const Text('Consider Burrito'),
                    ),
                    const SizedBox(height: 24),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          children: [
                            Text(
                              'Consideration Stats',
                              style:
                                  Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Total considerations: '
                              '${auth.burritoConsiderations}',
                            ),
                          ],
                        ),
                      ),
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
