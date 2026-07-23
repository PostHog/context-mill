package com.posthog.example.config;

import com.posthog.server.PostHog;
import com.posthog.server.PostHogConfig;
import com.posthog.server.PostHogInterface;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires a single PostHog client into the Spring context.
 *
 * <p>Key integration points demonstrated here:
 * <ul>
 *   <li><b>One client per process.</b> The client is a {@code @Bean}, so Spring
 *       creates exactly one instance and injects it everywhere. Never construct a
 *       new client per request.</li>
 *   <li><b>Config from the environment.</b> The project token and host are read
 *       from configuration (backed by env vars) &mdash; secrets are never hardcoded.</li>
 *   <li><b>Flush on shutdown.</b> {@code destroyMethod = "close"} makes Spring call
 *       {@link PostHogInterface#close()} when the context shuts down, so queued
 *       events are flushed before the JVM exits.</li>
 *   <li><b>Fail loudly, but never break the app.</b> A missing token logs a clear
 *       warning instead of throwing, so a misconfigured environment is obvious in
 *       dev without taking the whole service down.</li>
 * </ul>
 */
@Configuration
public class PostHogConfiguration {

    private static final Logger log = LoggerFactory.getLogger(PostHogConfiguration.class);

    @Bean(destroyMethod = "close")
    public PostHogInterface posthog(
            @Value("${posthog.project-token:}") String projectToken,
            @Value("${posthog.host:https://us.i.posthog.com}") String host) {

        if (projectToken == null || projectToken.isBlank()) {
            log.warn("POSTHOG_PROJECT_TOKEN is not set. PostHog events will not be delivered. "
                    + "Set it in your environment (see .env.example) to enable analytics.");
        }

        PostHogConfig config = PostHogConfig
                .builder(projectToken)
                .host(host)
                .build();

        return PostHog.with(config);
    }
}
