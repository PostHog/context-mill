# PostHog Spring Boot example

This is a [Spring Boot](https://spring.io/projects/spring-boot) example demonstrating PostHog integration with product analytics, feature flags, and user identification using the server-side Java SDK.

## Features

- **Product analytics**: Track user events and behaviors
- **User identification**: Associate events with authenticated users via person properties
- **Feature flags**: Control feature rollouts with PostHog feature flags
- **Server-side tracking**: All tracking happens server-side with the `posthog-server` SDK
- **Single client bean**: One PostHog client for the whole app, flushed on shutdown

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
    │   ├── application.properties   # Binds POSTHOG_* env vars into config
    │   └── templates/               # Thymeleaf pages
    │       ├── home.html            # Home / login page
    │       ├── burrito.html         # Event tracking
    │       ├── dashboard.html       # Feature flag example
    │       └── profile.html         # Error reporting
    └── java/com/posthog/example/
        ├── Application.java         # Spring Boot entry point
        ├── config/
        │   └── PostHogConfiguration.java   # The single PostHog client bean
        └── controller/
            └── BurritoController.java      # Events, identify, flags, errors
```

## Key integration points

### PostHog client bean (config/PostHogConfiguration.java)

Create **one client per process** and expose it as a singleton bean. `destroyMethod = "close"` makes Spring flush queued events when the app shuts down.

```java
@Bean(destroyMethod = "close")
public PostHogInterface posthog(
        @Value("${posthog.project-token:}") String projectToken,
        @Value("${posthog.host:https://us.i.posthog.com}") String host) {

    PostHogConfig config = PostHogConfig
            .builder(projectToken)
            .host(host)
            .build();

    return PostHog.with(config);
}
```

### Configuration from the environment (application.properties)

Read the token and host from the environment so secrets never live in source:

```properties
posthog.project-token=${POSTHOG_PROJECT_TOKEN:}
posthog.host=${POSTHOG_HOST:https://us.i.posthog.com}
```

### User identification (controller/BurritoController.java)

The server SDK identifies a user by attaching person properties to a capture with `userProperty(...)`. The `distinctId` (first argument) must match the id your frontend `identify` call uses.

```java
posthog.capture(
        userId,
        "user_logged_in",
        PostHogCaptureOptions
                .builder()
                .userProperty("email", email)
                .property("login_method", "email")
                .build());
```

### Event tracking (controller/BurritoController.java)

```java
posthog.capture(
        userId,
        "burrito_considered",
        PostHogCaptureOptions
                .builder()
                .property("total_considerations", count)
                .build());
```

### Feature flags (controller/BurritoController.java)

Evaluate flags once per request, then read individual flags off the snapshot. Avoid the deprecated per-flag helpers.

```java
PostHogFeatureFlagEvaluations flags = posthog.evaluateFlags(userId);
boolean showNewFeature = flags.isEnabled("new-dashboard-feature");
```

### Error reporting (controller/BurritoController.java)

There is no automatic exception capture in the Java server SDK, so report failures as an explicit event:

```java
try {
    riskyOperation();
} catch (RuntimeException e) {
    posthog.capture(
            userId,
            "error_occurred",
            PostHogCaptureOptions
                    .builder()
                    .property("error_type", e.getClass().getSimpleName())
                    .property("error_message", e.getMessage())
                    .build());
}
```

### Flush and shutdown

`destroyMethod = "close"` on the bean handles this for you at shutdown. If you ever
manage the client yourself, flush and close explicitly:

```java
posthog.flush(); // send any remaining events
posthog.close(); // shut down the client
```

## Learn more

- [PostHog Java integration](https://posthog.com/docs/libraries/java)
- [PostHog feature flags](https://posthog.com/docs/feature-flags)
- [PostHog documentation](https://posthog.com/docs)
- [Spring Boot documentation](https://spring.io/projects/spring-boot)
