import 'package:flutter/material.dart';

import '../auth/auth_state.dart';
import '../theme.dart';
import '../widgets/page_scaffold.dart';

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
  final _passwordController = TextEditingController();
  String _error = '';

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    setState(() => _error = '');
    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    if (username.isEmpty || password.isEmpty) {
      setState(() => _error = 'Please provide both username and password');
      return;
    }
    await AuthState.instance.logIn(username);
    if (!mounted) return;
    _usernameController.clear();
    _passwordController.clear();
  }

  @override
  Widget build(BuildContext context) {
    return PageScaffold(
      child: ListenableBuilder(
        listenable: AuthState.instance,
        builder: (context, _) {
          final auth = AuthState.instance;
          if (auth.isLoggedIn) {
            return _LoggedInView(username: auth.username!);
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text(
                  'Welcome to Burrito Consideration App',
                  style: AppTextStyles.h1,
                ),
              ),
              const Text(
                'Please sign in to begin your burrito journey',
                style: AppTextStyles.body,
              ),
              const SizedBox(height: 32),
              const _FieldLabel('Username:'),
              _TextInput(
                controller: _usernameController,
                hint: 'Enter any username',
                onSubmitted: _signIn,
              ),
              const SizedBox(height: 16),
              const _FieldLabel('Password:'),
              _TextInput(
                controller: _passwordController,
                hint: 'Enter any password',
                obscure: true,
                onSubmitted: _signIn,
              ),
              if (_error.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_error, style: AppTextStyles.error),
                ),
              const SizedBox(height: 16),
              _PrimaryButton(label: 'Sign In', onPressed: _signIn),
              const SizedBox(height: 32),
              const Center(
                child: Text(
                  'Note: This is a demo app. Use any username and password '
                  'to sign in.',
                  style: AppTextStyles.note,
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _LoggedInView extends StatelessWidget {
  const _LoggedInView({required this.username});

  final String username;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text('Welcome back, $username!', style: AppTextStyles.h1),
        ),
        const Text(
          'You are logged in. Feel free to explore:',
          style: AppTextStyles.body,
        ),
        const SizedBox(height: 16),
        const Padding(
          padding: EdgeInsets.only(left: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Bullet('Consider the potential of burritos'),
              _Bullet('View your profile and statistics'),
            ],
          ),
        ),
      ],
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: AppTextStyles.body),
          Expanded(child: Text(text, style: AppTextStyles.body)),
        ],
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text, style: AppTextStyles.label),
    );
  }
}

class _TextInput extends StatelessWidget {
  const _TextInput({
    required this.controller,
    required this.hint,
    required this.onSubmitted,
    this.obscure = false,
  });

  final TextEditingController controller;
  final String hint;
  final VoidCallback onSubmitted;
  final bool obscure;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      style: AppTextStyles.body,
      onSubmitted: (_) => onSubmitted(),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppTextStyles.body.copyWith(color: AppColors.note),
        isDense: true,
        contentPadding: const EdgeInsets.all(8),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(4),
          borderSide: const BorderSide(color: AppColors.primary),
        ),
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          overlayColor: AppColors.primaryHover,
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 32),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(4),
          ),
          textStyle: const TextStyle(fontSize: 16, height: 1.6),
        ),
        child: Text(label),
      ),
    );
  }
}
