import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

/// In-memory demo authentication demonstrating PostHog user identification.
///
/// Each username maps to a stable UUIDv4 so `identify()` always receives a
/// non-PII user ID while the username is sent in `userProperties`.
///
/// @see https://posthog.com/docs/libraries/flutter#identifying-users
class AuthState extends ChangeNotifier {
  /// In production, use [instance]. Tests construct fresh instances to
  /// stay isolated from each other.
  @visibleForTesting
  AuthState();

  static AuthState _instance = AuthState();
  static AuthState get instance => _instance;
  @visibleForTesting
  static set instance(AuthState value) => _instance = value;

  final Map<String, String> _userIdsByUsername = {};
  String? _userId;
  String? _username;
  int _burritoConsiderations = 0;

  String? get userId => _userId;
  String? get username => _username;
  bool get isLoggedIn => _userId != null && _username != null;
  int get burritoConsiderations => _burritoConsiderations;

  static String _generateUuidV4() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    String hex(int start, int end) => bytes
        .sublist(start, end)
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();

    return '${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}';
  }

  Future<void> logIn(String username) async {
    final trimmedUsername = username.trim();
    // Reject empty usernames before updating state or calling identify and capture,
    // rather than falling back to a shared placeholder identity.
    if (trimmedUsername.isEmpty) {
      return;
    }

    final normalizedKey = trimmedUsername.toLowerCase();
    final isNewUser = !_userIdsByUsername.containsKey(normalizedKey);
    final resolvedUserId = _userIdsByUsername.putIfAbsent(
      normalizedKey,
      _generateUuidV4,
    );

    _userId = resolvedUserId;
    _username = trimmedUsername;
    _burritoConsiderations = 0;
    notifyListeners();

    // Identify with a stable UUID and pass the username in userProperties, never as userId.
    await Posthog().identify(
      userId: resolvedUserId,
      userProperties: {'username': trimmedUsername},
      userPropertiesSetOnce: {
        'first_login_date': DateTime.now().toIso8601String(),
      },
    );

    await Posthog().capture(
      eventName: 'user_logged_in',
      properties: {
        'login_method': 'demo_form',
        'is_new_user': isNewUser,
      },
    );
  }

  Future<void> logOut() async {
    if (!isLoggedIn) {
      return;
    }

    _userId = null;
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
