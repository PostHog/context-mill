import 'package:flutter/material.dart';

import '../auth/auth_state.dart';
import 'burrito_screen.dart';
import 'profile_screen.dart';

/// Home/login screen.
///
/// Logging in identifies the user in PostHog (see AuthState.logIn).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  static const route = '/';

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _usernameController = TextEditingController();

  @override
  void dispose() {
    _usernameController.dispose();
    super.dispose();
  }

  Future<void> _logIn() async {
    final username = _usernameController.text.trim();
    if (username.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a username to log in')),
      );
      return;
    }
    await AuthState.instance.logIn(username);
    if (!mounted) return;
    _usernameController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Burrito App')),
      body: ListenableBuilder(
        listenable: AuthState.instance,
        builder: (context, _) {
          final auth = AuthState.instance;
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: auth.isLoggedIn
                    ? _LoggedInView(username: auth.username!)
                    : _LoginForm(
                        controller: _usernameController,
                        onLogIn: _logIn,
                      ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _LoginForm extends StatelessWidget {
  const _LoginForm({required this.controller, required this.onLogIn});

  final TextEditingController controller;
  final VoidCallback onLogIn;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Welcome to the Burrito App',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        const Text(
          'Log in to start considering burritos.',
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        TextField(
          controller: controller,
          decoration: const InputDecoration(
            labelText: 'Username',
            border: OutlineInputBorder(),
          ),
          textInputAction: TextInputAction.done,
          onSubmitted: (_) => onLogIn(),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: onLogIn,
          child: const Text('Log in'),
        ),
      ],
    );
  }
}

class _LoggedInView extends StatelessWidget {
  const _LoggedInView({required this.username});

  final String username;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Hello, $username!',
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () =>
              Navigator.of(context).pushNamed(BurritoScreen.route),
          child: const Text('Consider a burrito'),
        ),
        const SizedBox(height: 12),
        OutlinedButton(
          onPressed: () =>
              Navigator.of(context).pushNamed(ProfileScreen.route),
          child: const Text('Profile'),
        ),
      ],
    );
  }
}
