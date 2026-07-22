import 'package:flutter/material.dart';

import '../auth/auth_state.dart';
import '../screens/burrito_screen.dart';
import '../screens/home_screen.dart';
import '../screens/profile_screen.dart';
import '../theme.dart';

/// Dark navigation header mirroring the web examples' `.header` bar:
/// nav links on the left, user section with logout on the right.
/// Collapses to two stacked rows on narrow (mobile) screens.
class AppHeader extends StatelessWidget {
  const AppHeader({super.key});

  void _goTo(BuildContext context, String route) {
    final navigator = Navigator.of(context);
    if (ModalRoute.of(context)?.settings.name == route) return;
    if (route == HomeScreen.route) {
      navigator.popUntil((r) => r.isFirst);
    } else {
      navigator.pushNamed(route);
    }
  }

  Future<void> _logOut(BuildContext context) async {
    final navigator = Navigator.of(context);
    await AuthState.instance.logOut();
    navigator.popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.header,
      padding: const EdgeInsets.all(16),
      child: SafeArea(
        bottom: false,
        child: ListenableBuilder(
          listenable: AuthState.instance,
          builder: (context, _) {
            final auth = AuthState.instance;

            final nav = Wrap(
              spacing: 16,
              runSpacing: 4,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                _HeaderLink(
                  label: 'Home',
                  onTap: () => _goTo(context, HomeScreen.route),
                ),
                if (auth.isLoggedIn) ...[
                  _HeaderLink(
                    label: 'Burrito Consideration',
                    onTap: () => _goTo(context, BurritoScreen.route),
                  ),
                  _HeaderLink(
                    label: 'Profile',
                    onTap: () => _goTo(context, ProfileScreen.route),
                  ),
                ],
              ],
            );

            final userSection = Wrap(
              spacing: 16,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (auth.isLoggedIn) ...[
                  Text(
                    'Welcome, ${auth.username}!',
                    style: AppTextStyles.body.copyWith(color: Colors.white),
                  ),
                  _LogoutButton(onPressed: () => _logOut(context)),
                ] else
                  Text(
                    'Not logged in',
                    style: AppTextStyles.body.copyWith(color: Colors.white),
                  ),
              ],
            );

            return LayoutBuilder(
              builder: (context, constraints) {
                final narrow = constraints.maxWidth < 640;
                if (narrow) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [nav, const SizedBox(height: 8), userSection],
                  );
                }
                return Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1200),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [Flexible(child: nav), userSection],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}

class _HeaderLink extends StatelessWidget {
  const _HeaderLink({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      hoverColor: AppColors.headerHover,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        child: Text(
          label,
          style: AppTextStyles.body.copyWith(color: Colors.white),
        ),
      ),
    );
  }
}

class _LogoutButton extends StatelessWidget {
  const _LogoutButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        backgroundColor: AppColors.danger,
        foregroundColor: Colors.white,
        overlayColor: AppColors.dangerHover,
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        textStyle: const TextStyle(fontSize: 14, height: 1.6),
      ),
      child: const Text('Logout'),
    );
  }
}
