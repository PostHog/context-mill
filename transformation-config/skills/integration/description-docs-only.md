# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications using the official PostHog SDK documentation.

## Instructions

1. Detect the existing app structure and package manager. For Flutter, check `pubspec.yaml`, `pubspec.lock`, `android/`, `ios/`, `macos/`, and `web/`.
2. Read the matching reference file below before changing code. It is the source of truth for SDK installation, initialization, capture, identify, feature flags, error tracking, session replay, surveys, and platform-specific setup.
3. Install the SDK using the platform package manager. For Flutter, prefer `flutter pub add posthog_flutter` over manually editing `pubspec.yaml`.
4. Initialize PostHog once, using environment/configuration values for the project token and host. Never hardcode secrets.
5. Add identify calls at login/signup boundaries and reset on logout.
6. Verify with the project's normal analyzer, tests, or build commands.

## Reference files

{references}

## Key principles

- **Environment/configuration values**: Always use environment variables or platform configuration files for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the docs**: Follow the framework reference's initialization and capture patterns exactly.
- **Analytics contract**: Treat event names, property names, and feature flag keys as part of an analytics contract. Reuse existing names and patterns found in the project. When introducing new ones, make them clear, descriptive, and consistent with existing conventions.

## Framework guidelines

{commandments}
