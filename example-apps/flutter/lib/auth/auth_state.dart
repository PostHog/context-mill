import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

/// Fake in-memory authentication demonstrating PostHog user identification.
///
/// This is intentionally not production grade — there is no password and no
/// persistence. It exists to show where `identify()` and `reset()` belong in
/// a real login flow.
///
/// @see https://posthog.com/docs/libraries/flutter#identifying-users
class AuthState extends ChangeNotifier {
  AuthState._();

  static final instance = AuthState._();

  String? _username;
  int _burritoConsiderations = 0;

  String? get username => _username;
  bool get isLoggedIn => _username != null;
  int get burritoConsiderations => _burritoConsiderations;

  Future<void> logIn(String username) async {
    _username = username;
    _burritoConsiderations = 0;
    notifyListeners();

    // Identify the user as soon as they log in. Events captured anonymously
    // before this point are linked to the user retroactively.
    // Person data (like the username) belongs in userProperties ($set) and
    // userPropertiesSetOnce ($set_once), not in event properties.
    await Posthog().identify(
      userId: username,
      userProperties: {'username': username},
      userPropertiesSetOnce: {
        'first_login_date': DateTime.now().toIso8601String(),
      },
    );

    await Posthog().capture(
      eventName: 'user_logged_in',
      properties: {'login_method': 'demo_form'},
    );
  }

  Future<void> logOut() async {
    _username = null;
    _burritoConsiderations = 0;
    notifyListeners();

    await Posthog().capture(eventName: 'user_logged_out');

    // Clears the distinct ID and anonymous ID so the next user on this
    // device starts a fresh identity.
    await Posthog().reset();
  }

  int incrementBurritoConsiderations() {
    _burritoConsiderations++;
    notifyListeners();
    return _burritoConsiderations;
  }
}
