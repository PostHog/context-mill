import 'package:flutter/material.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../auth/auth_state.dart';
import '../theme.dart';
import '../widgets/page_scaffold.dart';

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
        const SnackBar(content: Text('Error captured and sent to PostHog!')),
      );
    }
  }

  String _journeyMessage(int considerations) {
    if (considerations == 0) {
      return "You haven't considered any burritos yet. "
          'Visit the Burrito Consideration page to start!';
    }
    if (considerations == 1) {
      return "You've considered the burrito potential once. Keep going!";
    }
    if (considerations < 5) {
      return "You're getting the hang of burrito consideration!";
    }
    if (considerations < 10) {
      return "You're becoming a burrito consideration expert!";
    }
    return 'You are a true burrito consideration master! 🌯';
  }

  @override
  Widget build(BuildContext context) {
    return PageScaffold(
      child: ListenableBuilder(
        listenable: AuthState.instance,
        builder: (context, _) {
          final auth = AuthState.instance;
          if (!auth.isLoggedIn) {
            return const Text('Not logged in.', style: AppTextStyles.body);
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text('User Profile', style: AppTextStyles.h1),
              ),
              StatsBox(
                children: [
                  const Text('Your Information', style: AppTextStyles.h2),
                  _BoldLabelText(
                    label: 'Username:',
                    value: auth.username!,
                  ),
                  _BoldLabelText(
                    label: 'Burrito Considerations:',
                    value: '${auth.burritoConsiderations}',
                  ),
                ],
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => _triggerTestError(context),
                  style: TextButton.styleFrom(
                    backgroundColor: AppColors.danger,
                    foregroundColor: Colors.white,
                    overlayColor: AppColors.dangerHover,
                    padding: const EdgeInsets.symmetric(
                      vertical: 12,
                      horizontal: 32,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(4),
                    ),
                    textStyle: const TextStyle(fontSize: 16, height: 1.6),
                  ),
                  child: const Text('Trigger Test Error (for PostHog)'),
                ),
              ),
              const SizedBox(height: 32),
              const Text('Your Burrito Journey', style: AppTextStyles.h3),
              const SizedBox(height: 8),
              Text(
                _journeyMessage(auth.burritoConsiderations),
                style: AppTextStyles.body,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _BoldLabelText extends StatelessWidget {
  const _BoldLabelText({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        style: AppTextStyles.body,
        children: [
          TextSpan(
            text: '$label ',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          TextSpan(text: value),
        ],
      ),
    );
  }
}
