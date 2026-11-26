package com.posthog.example.config;

import com.posthog.server.PostHog;
import com.posthog.server.PostHogConfig;
import com.posthog.server.PostHogInterface;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.lang.Nullable;

/**
 * Wires a single PostHog client into the Spring context when configured.
 *
 * <p>Key integration points demonstrated here:
 * <ul>
 *   <li><b>One client per process.</b> The client is a {@code @Bean}, so Spring
 *       creates one instance and injects it everywhere. Never construct a new client per request.</li>
 *   <li><b>Config from the environment.</b> The project token and host are read
 *       from Spring {@link Environment} so secrets never live in source.</li>
 *   <li><b>Flush on shutdown.</b> {@code destroyMethod = "close"} makes Spring call
 *       {@link PostHogInterface#close()} when the context shuts down so queued
 *       events are flushed before the JVM exits.</li>
 *   <li><b>Skip initialization when unconfigured.</b> A missing token logs a warning
 *       outside production and returns {@code null} instead of building a client with an empty key.</li>
 * </ul>
 */
@Configuration
public class PostHogConfiguration {

    private static final Logger log = LoggerFactory.getLogger(PostHogConfiguration.class);

    @Bean(destroyMethod = "close")
    @Nullable
    public PostHogInterface posthog(Environment environment) {
        // Read the project token optionally and never call PostHogConfig.builder("") with a blank or fallback key,
        // so unconfigured environments skip SDK initialization cleanly.
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

        PostHogConfig config = PostHogConfig
                .builder(projectToken)
                .host(host)
                .build();

        return PostHog.with(config);
    }
}
