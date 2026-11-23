package com.posthog.example.controller;

import com.posthog.server.PostHogCaptureOptions;
import com.posthog.server.PostHogFeatureFlagEvaluations;
import com.posthog.server.PostHogInterface;
import jakarta.servlet.http.HttpSession;
import java.util.UUID;
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
        // Only signed-in users have a "userId"; anonymous visitors see the login form.
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
     * <p>Capture a meaningful business event with the visitor's distinct id and a couple of
     * event properties. Keep PII in person properties (see {@link #login}), not here.
     */
    @PostMapping("/burrito")
    public String considerBurrito(HttpSession session, Model model) {
        Visitor visitor = visitor(session);
        Object previous = session.getAttribute("burritoCount");
        int count = (previous == null ? 0 : (int) previous) + 1;
        session.setAttribute("burritoCount", count);

        PostHogCaptureOptions.Builder options = PostHogCaptureOptions
                .builder()
                .property("total_considerations", count);
        posthog.capture(visitor.id(), "burrito_considered", withPersonProfile(options, visitor).build());

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
        Visitor visitor = visitor(session);
        String userId = visitor.id();
        try {
            riskyOperation();
        } catch (RuntimeException e) {
            log.warn("profile risky_operation failed", e);
            PostHogCaptureOptions.Builder options = PostHogCaptureOptions
                    .builder()
                    .property("error_type", e.getClass().getSimpleName())
                    .property("error_message", e.getMessage())
                    .property("source", "profile_view");
            posthog.capture(userId, "error_occurred", withPersonProfile(options, visitor).build());
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
     * Resolves the distinct id. Signed-in users keep their stable user id (it must match
     * your frontend {@code identify} call). Signed-out visitors get a random UUID kept in
     * the session, so it is reused for the rest of the visit instead of every visitor
     * sharing one id.
     */
    private Visitor visitor(HttpSession session) {
        Object userId = session.getAttribute("userId");
        if (userId != null) {
            return new Visitor(userId.toString(), false);
        }
        Object anonymousId = session.getAttribute("anonymousId");
        if (anonymousId == null) {
            anonymousId = UUID.randomUUID().toString();
            session.setAttribute("anonymousId", anonymousId);
        }
        return new Visitor(anonymousId.toString(), true);
    }

    /**
     * Anonymous events set {@code $process_person_profile} to false so PostHog does not
     * create a person profile for the visitor.
     */
    private PostHogCaptureOptions.Builder withPersonProfile(PostHogCaptureOptions.Builder options, Visitor visitor) {
        return visitor.anonymous() ? options.property("$process_person_profile", false) : options;
    }
}
