# PostHog integration for {display_name}

This skill helps you add PostHog analytics to {display_name} applications using the official PostHog Kotlin Multiplatform SDK documentation.

## Instructions

1. Detect the existing Kotlin Multiplatform app structure. Check `settings.gradle.kts`, the shared module's `build.gradle.kts` (look for the `kotlin("multiplatform")` plugin and a `commonMain` source set), and the per-platform entry points (Android `Application`/`Activity`, iOS `MainViewController`, web `main`).
2. Read the reference files below before changing code. They are the source of truth for SDK installation, initialization, event capture, identification, feature flags, group analytics, session replay, and error tracking.
3. Install the SDK by adding `implementation("com.posthog:posthog-kmp:<version>")` to the shared module's `commonMain` dependencies in `build.gradle.kts` — not to a platform-specific source set. Check the latest version on Maven Central (https://central.sonatype.com/artifact/com.posthog/posthog-kmp) rather than hardcoding a stale one.
4. Initialize PostHog once, early in the app lifecycle, from shared code: `PostHog.setup(config = PostHogConfig(apiKey = ..., host = ...), context = PostHogContext())`. Use environment or generated build-config values for the project token and host. Never hardcode secrets.
5. Build `PostHogContext` per platform: on Android pass `PostHogContext(application)`; on iOS and web use the no-argument `PostHogContext()`. All PostHog APIs live in the `com.posthog.kmp` package.
6. Add `PostHog.identify(...)` at login/signup boundaries and `PostHog.reset()` on logout.
7. Verify with the project's normal Gradle commands, such as `./gradlew build`, or the repository's existing checks.

## Reference files

{references}

## Key principles

- **Environment/configuration values**: Always use environment variables or generated build config for PostHog keys. Never hardcode them.
- **Minimal changes**: Add PostHog code alongside existing integrations. Don't replace or restructure existing code.
- **Match the docs**: Follow the Kotlin Multiplatform reference's initialization and capture patterns exactly.
- **Analytics contract**: Treat event names, property names, and feature flag keys as part of an analytics contract. Reuse existing names and patterns found in the project. When introducing new ones, make them clear, descriptive, and consistent with existing conventions.

## Framework guidelines

{commandments}
