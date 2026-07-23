import 'package:flutter_test/flutter_test.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
// The platform interface is not exported from the package barrel — tests
// import it from src/ to swap in a fake, the same way the SDK's own test
// suite does.
import 'package:posthog_flutter/src/posthog_flutter_platform_interface.dart';

/// A hand-written fake of the PostHog platform interface that records every
/// call so tests can assert on what would have been sent to PostHog.
///
/// Hand-written (instead of generated with mockito/mocktail) because the
/// platform interface uses `PlatformInterface.verifyToken`, which requires
/// fakes to `extend` the base class — generated mocks `implement` it and are
/// rejected at runtime. This mirrors `PosthogFlutterPlatformFake` in the
/// posthog_flutter package's own tests.
class FakePosthogPlatform extends PosthogFlutterPlatformInterface {
  final setupConfigs = <PostHogConfig>[];
  final identifyCalls = <IdentifyCall>[];
  final capturedEvents = <CapturedEvent>[];
  final capturedExceptions = <CapturedException>[];
  final screenNames = <String>[];
  int resetCallCount = 0;

  /// Method names in invocation order, for asserting call ordering
  /// (e.g. identify before capture, capture before reset).
  final callOrder = <String>[];

  @override
  Future<void> setup(PostHogConfig config) async {
    callOrder.add('setup');
    setupConfigs.add(config);
  }

  @override
  Future<void> identify({
    required String userId,
    Map<String, Object>? userProperties,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {
    callOrder.add('identify');
    identifyCalls.add((
      userId: userId,
      userProperties: userProperties,
      userPropertiesSetOnce: userPropertiesSetOnce,
    ));
  }

  @override
  Future<void> capture({
    required String eventName,
    Map<String, Object>? properties,
    Map<String, Object>? userProperties,
    Map<String, Object>? userPropertiesSetOnce,
  }) async {
    callOrder.add('capture');
    capturedEvents.add((eventName: eventName, properties: properties));
  }

  @override
  Future<void> captureException({
    required Object error,
    StackTrace? stackTrace,
    Map<String, Object>? properties,
  }) async {
    callOrder.add('captureException');
    capturedExceptions.add((
      error: error,
      stackTrace: stackTrace,
      properties: properties,
    ));
  }

  @override
  Future<void> screen({
    required String screenName,
    Map<String, Object>? properties,
  }) async {
    callOrder.add('screen');
    screenNames.add(screenName);
  }

  @override
  Future<void> reset() async {
    callOrder.add('reset');
    resetCallCount++;
  }

  @override
  Future<void> close() async {}

  void clear() {
    setupConfigs.clear();
    identifyCalls.clear();
    capturedEvents.clear();
    capturedExceptions.clear();
    screenNames.clear();
    resetCallCount = 0;
    callOrder.clear();
  }
}

typedef IdentifyCall = ({
  String userId,
  Map<String, Object>? userProperties,
  Map<String, Object>? userPropertiesSetOnce,
});

typedef CapturedEvent = ({String eventName, Map<String, Object>? properties});

typedef CapturedException = ({
  Object error,
  StackTrace? stackTrace,
  Map<String, Object>? properties,
});

/// Installs a [FakePosthogPlatform] for the current test and registers a
/// teardown that restores whatever platform implementation was installed
/// before. Call from `setUp`.
FakePosthogPlatform installFakePosthog() {
  // Reading `instance` lazily constructs the default PosthogFlutterIO,
  // which registers a MethodChannel handler — that needs the binding,
  // even in non-widget tests.
  TestWidgetsFlutterBinding.ensureInitialized();
  final original = PosthogFlutterPlatformInterface.instance;

  final fake = FakePosthogPlatform();
  PosthogFlutterPlatformInterface.instance = fake;

  addTearDown(() async {
    // Clear the Posthog singleton's internal state (current screen,
    // installed error handlers) while the fake is still installed, then
    // hand back the original implementation.
    await Posthog().close();
    PosthogFlutterPlatformInterface.instance = original;
  });
  return fake;
}
