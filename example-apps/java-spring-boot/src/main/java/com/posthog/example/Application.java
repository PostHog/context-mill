package com.posthog.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Entry point for the PostHog Spring Boot example.
 *
 * <p>The integration code lives in:
 * <ul>
 *   <li>{@link com.posthog.example.config.PostHogConfiguration}, the optional singleton
 *       PostHog client bean flushed on shutdown.</li>
 *   <li>{@link com.posthog.example.controller.BurritoController}, where events,
 *       user identification, feature flags, and error reporting happen.</li>
 * </ul>
 */
@SpringBootApplication
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
