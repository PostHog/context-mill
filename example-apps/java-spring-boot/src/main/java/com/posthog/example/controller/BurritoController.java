package com.posthog.example.controller;

import com.posthog.server.PostHogCaptureOptions;
import com.posthog.server.PostHogFeatureFlagEvaluations;
import com.posthog.server.PostHogInterface;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * A tiny "burrito" app that mirrors the other PostHog example apps.
 *
 * <p>Each handler shows one integration point. The PostHog client is injected once
 * (constructor injection) and reused &mdash; the same singleton bean from
 * {@link com.posthog.example.config.PostHogConfiguration}.
 */
@Controller
public class BurritoController {

    private static final Logger log = LoggerFactory.getLogger(BurritoController.class);

    private final PostHogInterface posthog;

    public BurritoController(PostHogInterface posthog) {
        this.posthog = posthog;
    }

    /** Home / login page. */
    @GetMapping("/")
    public String home(HttpSession session, Model model) {
        model.addAttribute("userId", session.getAttribute("userId"));
        return "home";
    }

    /**
     * User identification.
     *
     * <p>The server SDK identifies a user by attaching person properties to a capture
     * via {@code userProperty(...)}. The {@code distinctId} (first argument) is the
     * stable user id and must match the id used by your frontend {@code identify} call.
     *
     * <p><b>Identity note:</b> this demo takes the id from a form field for simplicity.
     * A real app must derive {@code distinctId} from the authenticated principal
     * (session / JWT), never from an unverified request parameter — otherwise a client
     * could pick any id and overwrite another person's profile.
     */
    @PostMapping("/login")
    public String login(@RequestParam String userId,
                        @RequestParam(required = false) String email,
                        HttpSession session) {
        session.setAttribute("userId", userId);

        posthog.capture(
                userId,
                "user_logged_in",
                PostHogCaptureOptions
                        .builder()
                        .userProperty("email", email == null ? "" : email)
                        .property("login_method", "email")
                        .build());

        return "redirect:/";
    }

    /**
     * Event tracking.
     *
     * <p>Capture a meaningful business event with a stable distinct id and a couple of
     * event properties. Keep PII in person properties (see {@link #login}), not here.
     */
    @PostMapping("/burrito")
    public String considerBurrito(HttpSession session, Model model) {
        String userId = distinctId(session);
        Object previous = session.getAttribute("burritoCount");
        int count = (previous == null ? 0 : (int) previous) + 1;
        session.setAttribute("burritoCount", count);

        posthog.capture(
                userId,
                "burrito_considered",
                PostHogCaptureOptions
                        .builder()
                        .property("total_considerations", count)
                        .build());

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
        String userId = distinctId(session);

        // evaluateFlags makes a network call; if PostHog is slow or down it can throw.
        // Never let flag evaluation take the page down — fall back to the flag being off.
        // (This fetches on every request; a real app should cache/bound it, not fetch per render.)
        boolean showNewFeature = false;
        try {
            PostHogFeatureFlagEvaluations flags = posthog.evaluateFlags(userId);
            showNewFeature = flags.isEnabled("new-dashboard-feature");
        } catch (RuntimeException e) {
            log.warn("feature flag evaluation failed", e);
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
        String userId = distinctId(session);
        try {
            riskyOperation();
        } catch (RuntimeException e) {
            log.warn("profile risky_operation failed", e);
            posthog.capture(
                    userId,
                    "error_occurred",
                    PostHogCaptureOptions
                            .builder()
                            .property("error_type", e.getClass().getSimpleName())
                            .property("error_message", e.getMessage())
                            .property("source", "profile_view")
                            .build());
            model.addAttribute("error", e.getMessage());
        }
        model.addAttribute("userId", userId);
        return "profile";
    }

    private void riskyOperation() {
        throw new IllegalStateException("profile data source is temporarily unavailable");
    }

    /** Falls back to "anonymous" when no one has logged in yet. */
    private String distinctId(HttpSession session) {
        Object userId = session.getAttribute("userId");
        return userId == null ? "anonymous" : userId.toString();
    }
}
