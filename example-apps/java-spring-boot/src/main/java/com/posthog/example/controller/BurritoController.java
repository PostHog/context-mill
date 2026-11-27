package com.posthog.example.controller;

import com.posthog.server.PostHogCaptureOptions;
import com.posthog.server.PostHogFeatureFlagEvaluations;
import com.posthog.server.PostHogInterface;
import jakarta.servlet.http.HttpSession;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * A tiny "burrito" app that mirrors the other PostHog example apps.
 *
 * <p>Each handler shows one integration point. The optional PostHog client is injected
 * once via constructor injection and reused across requests.
 */
@Controller
public class BurritoController {

    private static final Logger log = LoggerFactory.getLogger(BurritoController.class);

    @Nullable
    private final PostHogInterface posthog;

    private final Map<String, String> usersByAccount = new ConcurrentHashMap<>();

    public BurritoController(@Nullable PostHogInterface posthog) {
        this.posthog = posthog;
    }

    /** Home and login page. */
    @GetMapping("/")
    public String home(HttpSession session, Model model) {
        // Only signed-in users have a "userId", and anonymous visitors see the login form.
        model.addAttribute("userId", session.getAttribute("userId"));
        return "home";
    }

    /**
     * User identification.
     *
     * <p>The server SDK identifies a user by attaching person properties to a capture
     * via {@code userProperty(...)}. The {@code distinctId} is a stable UUID mapped from
     * the authenticated account and never raw PII like an email or username.
     */
    @PostMapping("/login")
    public String login(@RequestParam(required = false) String username,
                        @RequestParam(required = false) String email,
                        @RequestParam(required = false, name = "userId") String legacyAccount,
                        HttpSession session) {
        String trimmedUsername = username == null ? "" : username.trim();
        String trimmedEmail = email == null ? "" : email.trim();
        String trimmedLegacy = legacyAccount == null ? "" : legacyAccount.trim();
        String accountKey = !trimmedEmail.isEmpty()
                ? trimmedEmail
                : (!trimmedUsername.isEmpty() ? trimmedUsername : trimmedLegacy);

        // Require a non-blank login identifier and never fall back to a shared placeholder id,
        // otherwise blank submissions merge unrelated visitors into one PostHog person profile.
        if (accountKey.isEmpty()) {
            return "redirect:/";
        }

        String distinctId = usersByAccount.computeIfAbsent(
                accountKey.toLowerCase(Locale.ROOT),
                ignored -> UUID.randomUUID().toString());
        session.setAttribute("userId", distinctId);

        if (posthog != null) {
            String loginMethod = !trimmedEmail.isEmpty() ? "email" : "username";
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

        return "redirect:/";
    }

    @PostMapping("/logout")
    public String logout(HttpSession session) {
        Object existing = session.getAttribute("userId");
        // Only capture user_logged_out when an authenticated user session actually exists.
        if (existing != null && !existing.toString().isBlank() && posthog != null) {
            posthog.capture(existing.toString().trim(), "user_logged_out");
        }
        session.removeAttribute("userId");
        return "redirect:/";
    }

    /**
     * Event tracking.
     *
     * <p>Capture a meaningful business event with the visitor's distinct id and non-PII
     * event properties. Keep PII in person properties (see {@link #login}), not here.
     */
    @PostMapping("/burrito")
    public String considerBurrito(HttpSession session, Model model) {
        Visitor visitor = visitor(session);
        Object previous = session.getAttribute("burritoCount");
        int count = (previous == null ? 0 : (int) previous) + 1;
        session.setAttribute("burritoCount", count);

        if (posthog != null) {
            PostHogCaptureOptions.Builder options = PostHogCaptureOptions
                    .builder()
                    .property("total_considerations", count);
            posthog.capture(visitor.id(), "burrito_considered", withPersonProfile(options, visitor).build());
        }

        model.addAttribute("count", count);
        return "burrito";
    }

    /**
     * Feature flags.
     *
     * <p>Evaluate flags once per request with {@code evaluateFlags(distinctId)}, then read
     * individual flags off the returned snapshot. Avoid the deprecated per-flag helpers.
     */
    @GetMapping("/dashboard")
    public String dashboard(HttpSession session, Model model) {
        String userId = visitor(session).id();

        // evaluateFlags makes a network call, and if PostHog is slow or down it can throw.
        // Never let flag evaluation take the page down, so fall back to false on failure.
        boolean showNewFeature = false;
        if (posthog != null) {
            try {
                PostHogFeatureFlagEvaluations flags = posthog.evaluateFlags(userId);
                showNewFeature = flags.isEnabled("new-dashboard-feature");
            } catch (RuntimeException e) {
                log.warn("feature flag evaluation failed", e);
            }
        }

        model.addAttribute("showNewFeature", showNewFeature);
        return "dashboard";
    }

    /**
     * Error reporting.
     *
     * <p>Note: the PostHog Java server SDK does not have automatic exception capture, so
     * we report failures as an explicit event with the exception details. Do not promise
     * or scaffold error-tracking features the SDK does not support.
     */
    @GetMapping("/profile")
    public String profile(HttpSession session, Model model) {
        Visitor visitor = visitor(session);
        String userId = visitor.id();
        try {
            riskyOperation();
        } catch (RuntimeException e) {
            log.warn("profile risky_operation failed", e);
            if (posthog != null) {
                PostHogCaptureOptions.Builder options = PostHogCaptureOptions
                        .builder()
                        .property("error_type", e.getClass().getSimpleName())
                        .property("error_message", e.getMessage())
                        .property("source", "profile_view");
                posthog.capture(userId, "error_occurred", withPersonProfile(options, visitor).build());
            }
            model.addAttribute("error", e.getMessage());
        }
        model.addAttribute("userId", userId);
        return "profile";
    }

    private void riskyOperation() {
        throw new IllegalStateException("profile data source is temporarily unavailable");
    }

    /** The distinct id for the current request and whether the visitor is anonymous. */
    private record Visitor(String id, boolean anonymous) {}

    /**
     * Resolves the distinct id. Signed-in users keep their stable UUID (matching frontend
     * {@code identify} calls). Signed-out visitors get a random UUID kept in the session
     * so it is reused for the rest of the visit instead of sharing one fixed id across visitors.
     */
    private Visitor visitor(HttpSession session) {
        Object userId = session.getAttribute("userId");
        if (userId != null && !userId.toString().isBlank()) {
            return new Visitor(userId.toString().trim(), false);
        }
        Object anonymousId = session.getAttribute("anonymousId");
        if (anonymousId == null || anonymousId.toString().isBlank()) {
            anonymousId = UUID.randomUUID().toString();
            session.setAttribute("anonymousId", anonymousId);
        }
        return new Visitor(anonymousId.toString().trim(), true);
    }

    /**
     * Anonymous events set {@code $process_person_profile} to false so PostHog does not
     * create a person profile for the visitor.
     */
    private PostHogCaptureOptions.Builder withPersonProfile(PostHogCaptureOptions.Builder options, Visitor visitor) {
        return visitor.anonymous() ? options.property("$process_person_profile", false) : options;
    }
}
