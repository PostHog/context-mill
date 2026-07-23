import 'dart:async';

import 'package:flutter/material.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../auth/auth_state.dart';
import '../theme.dart';
import '../widgets/page_scaffold.dart';

/// Burrito Consideration Screen.
///
/// Demonstrates PostHog event capture with custom properties. Each time the
/// user considers a burrito, an event is captured.
///
/// @see https://posthog.com/docs/libraries/flutter#capturing-events
class BurritoScreen extends StatefulWidget {
  const BurritoScreen({super.key});

  static const route = '/burrito';

  @override
  State<BurritoScreen> createState() => _BurritoScreenState();
}

class _BurritoScreenState extends State<BurritoScreen> {
  bool _hasConsidered = false;
  Timer? _resetTimer;

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }

  Future<void> _considerBurrito() async {
    final total = AuthState.instance.incrementBurritoConsiderations();
    setState(() => _hasConsidered = true);
    _resetTimer?.cancel();
    _resetTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _hasConsidered = false);
    });

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
    return PageScaffold(
      child: ListenableBuilder(
        listenable: AuthState.instance,
        builder: (context, _) {
          final auth = AuthState.instance;
          if (!auth.isLoggedIn) {
            return const Text(
              'Log in to consider burritos.',
              style: AppTextStyles.body,
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text(
                  'Burrito consideration zone',
                  style: AppTextStyles.h1,
                ),
              ),
              const Text(
                'Take a moment to truly consider the potential of burritos.',
                style: AppTextStyles.body,
              ),
              const SizedBox(height: 8),
              Center(
                child: Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: TextButton(
                        onPressed: _considerBurrito,
                        style: TextButton.styleFrom(
                          backgroundColor: AppColors.success,
                          foregroundColor: Colors.white,
                          overlayColor: AppColors.successHover,
                          padding: const EdgeInsets.symmetric(
                            vertical: 16,
                            horizontal: 32,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(4),
                          ),
                          textStyle: const TextStyle(
                            fontSize: 18,
                            height: 1.6,
                          ),
                        ),
                        child: const Text(
                          'I have considered the burrito potential',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                    if (_hasConsidered)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          'Thank you for your consideration! '
                          'Count: ${auth.burritoConsiderations}',
                          style: AppTextStyles.success,
                          textAlign: TextAlign.center,
                        ),
                      ),
                  ],
                ),
              ),
              StatsBox(
                children: [
                  const Text('Consideration stats', style: AppTextStyles.h3),
                  Text(
                    'Total considerations: ${auth.burritoConsiderations}',
                    style: AppTextStyles.body,
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}
