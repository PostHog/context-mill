# PostHog Spring Boot example

This is a [Spring Boot](https://spring.io/projects/spring-boot) example demonstrating PostHog integration with product analytics, feature flags, and user identification using the server-side Java SDK.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with a stable UUID via person properties, while signed-out visitors get a random session UUID and personless events
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Server-side tracking**: All tracking happens server-side with the `posthog-server` SDK
- **Single client bean**: One PostHog client for the whole app when configured, flushed on shutdown

> **Note on error tracking:** the PostHog Java server SDK does not have automatic
> exception capture. This example reports failures as an explicit `error_occurred`
> event instead. Do not expect session replay or surveys from the server SDK either.

## Getting started

### 1. Configure environment variables

Copy `.env.example` to `.env` and fill in your values, then export them:

```bash
export POSTHOG_PROJECT_TOKEN=your_posthog_project_token
export POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

### 2. Run the app

```bash
./gradlew bootRun
```

Open [http://localhost:8000](http://localhost:8000) with your browser to see the app.

## Project structure

```
java-spring-boot/
├── build.gradle                 # Gradle build with the posthog-server dependency
├── settings.gradle
├── .env.example                 # Environment variable template
├── .gitignore
└── src/main/
    ├── resources/
    │   ├── application.properties   # Binds POSTHOG_HOST into config
    │   └── templates/               # Thymeleaf pages
    │       ├── home.html            # Home and login page
    │       ├── burrito.html         # Event tracking
    │       ├── dashboard.html       # Feature flag example
    │       └── profile.html         # Error reporting
    └── java/com/posthog/example/
        ├── Application.java         # Spring Boot entry point
        ├── config/
        │   └── PostHogConfiguration.java   # Optional singleton PostHog client bean
        └── controller/
            └── BurritoController.java      # Events, identify, flags, errors
```

## Key integration points

### PostHog client bean (config/PostHogConfiguration.java)

Read `POSTHOG_PROJECT_TOKEN` and `POSTHOG_HOST` from Spring `Environment` so secrets never live in source. When the token is missing or blank, log a warning outside `prod` and `production` profiles and return `null` rather than calling `PostHogConfig.builder("")`. When configured, expose **one client per process** with `destroyMethod = "close"` so Spring flushes queued events on shutdown.

```java
@Bean(destroyMethod = "close")
@Nullable
public PostHogInterface posthog(Environment environment) {
    String rawToken = environment.getProperty("POSTHOG_PROJECT_TOKEN");
    if (rawToken == null || rawToken.isBlank()) {
        rawToken = environment.getProperty("posthog.project-token");
    }
    String projectToken = rawToken == null ? null : rawToken.trim();

    if (projectToken == null || projectToken.isBlank()) {
        if (!environment.matchesProfiles("prod", "production")) {
            log.warn("POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured");
        }
        return null;
    }

    String rawHost = environment.getProperty("POSTHOG_HOST");
    if (rawHost == null || rawHost.isBlank()) {
        rawHost = environment.getProperty("posthog.host");
    }
    String host = (rawHost == null || rawHost.isBlank())
            ? "https://us.i.posthog.com"
            : rawHost.trim();

    PostHogConfig config = PostHogConfig.builder(projectToken).host(host).build();
    return PostHog.with(config);
}
```

### User identification (controller/BurritoController.java)

Validate login input and skip session creation and event capture when blank. Map each login account to a stable UUID in memory so `distinctId` is never raw PII, and attach `email` or `username` via `userProperty(...)` only when non-blank.

```java
String distinctId = usersByAccount.computeIfAbsent(
        accountKey.toLowerCase(Locale.ROOT),
        ignored -> UUID.randomUUID().toString());
session.setAttribute("userId", distinctId);

if (posthog != null) {
    PostHogCaptureOptions.Builder options = PostHogCaptureOptions
            .builder()
            .property("login_method", loginMethod);
    if (!trimmedEmail.isEmpty()) {
        options.userProperty("email", trimmedEmail);
    }
    if (!trimmedUsername.isEmpty()) {
        options.userProperty("username", trimmedUsername);
    }
    posthog.capture(distinctId, "user_logged_in", options.build());
}
```

### Signed-out visitors (controller/BurritoController.java)

The `visitor` helper returns the distinct id and whether the visitor is anonymous. Signed-in users keep their stable UUID from the session. For everyone else it generates a random UUID, stores it in the cookie-backed session so it is reused for the rest of the visit, and sets `$process_person_profile` to `false` on their events so PostHog does not create a person profile for them.

```java
Visitor visitor = visitor(session);

if (posthog != null) {
    PostHogCaptureOptions.Builder options = PostHogCaptureOptions
            .builder()
            .property("total_considerations", count);
    if (visitor.anonymous()) {
        options.property("$process_person_profile", false);
    }
    posthog.capture(visitor.id(), "burrito_considered", options.build());
}
```

Feature flags use the same visitor id, so flag evaluation works for anonymous visitors too.

### Event tracking (controller/BurritoController.java)

```java
Visitor visitor = visitor(session);
if (posthog != null) {
    PostHogCaptureOptions.Builder options = PostHogCaptureOptions
            .builder()
            .property("total_considerations", count);
    posthog.capture(visitor.id(), "burrito_considered", withPersonProfile(options, visitor).build());
}
```

### Feature flags (controller/BurritoController.java)

Evaluate flags once per request when `posthog != null`, then read individual flags off the snapshot. Avoid the deprecated per-flag helpers.

```java
if (posthog != null) {
    PostHogFeatureFlagEvaluations flags = posthog.evaluateFlags(userId);
    showNewFeature = flags.isEnabled("new-dashboard-feature");
}
```

### Error reporting (controller/BurritoController.java)

There is no automatic exception capture in the Java server SDK, so report failures as an explicit event:

```java
try {
    riskyOperation();
} catch (RuntimeException e) {
    if (posthog != null) {
        PostHogCaptureOptions.Builder options = PostHogCaptureOptions
                .builder()
                .property("error_type", e.getClass().getSimpleName())
                .property("error_message", e.getMessage())
                .property("source", "profile_view");
        posthog.capture(userId, "error_occurred", withPersonProfile(options, visitor).build());
    }
}
```

### Flush and shutdown

`destroyMethod = "close"` on the bean handles flushing at shutdown when PostHog is configured. If you manage the client yourself, flush and close explicitly:

```java
posthog.flush();
posthog.close();
```

## Learn more

- [PostHog Java integration](https://posthog.com/docs/libraries/java)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog documentation](https://posthog.com/docs)
- [Spring Boot documentation](https://spring.io/projects/spring-boot)
