import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { posthog } from "./posthog";
// The demo has no auth provider, so the client passes its user id. In a real
// app, resolve the user id on the server (for example with ctx.auth) and use
// that as the distinctId.
const visitorArgs = {
    userId: v.optional(v.string()),
    anonymousId: v.string(),
    sessionId: v.optional(v.string()),
};
// Signed-in users keep their own id. Signed-out visitors use the random id
// posthog-js keeps for the visit, and send $process_person_profile: false so
// PostHog creates no person profile for them.
function visitorProperties(args) {
    return {
        ...(args.userId ? {} : { $process_person_profile: false }),
        ...(args.sessionId ? { $session_id: args.sessionId } : {}),
    };
}
export const login = mutation({
    args: { userId: v.string(), email: v.string(), sessionId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        // Identify once, on login. Use the same id in posthog.identify() in the browser.
        await posthog.identify(ctx, {
            distinctId: args.userId,
            properties: { email: args.email },
        });
        await posthog.capture(ctx, {
            distinctId: args.userId,
            event: "user_logged_in",
            properties: {
                login_method: "email",
                ...(args.sessionId ? { $session_id: args.sessionId } : {}),
            },
        });
    },
});
export const considerBurrito = mutation({
    args: { ...visitorArgs, totalConsiderations: v.number() },
    handler: async (ctx, args) => {
        await posthog.capture(ctx, {
            distinctId: args.userId ?? args.anonymousId,
            event: "burrito_considered",
            properties: {
                total_considerations: args.totalConsiderations,
                ...visitorProperties(args),
            },
        });
    },
});
// Remote evaluation runs in an action and needs no personal API key. Queries
// can use the local getFeatureFlag() once POSTHOG_PERSONAL_API_KEY is set.
export const dashboard = action({
    args: visitorArgs,
    handler: async (ctx, args) => {
        try {
            const enabled = await posthog.evaluateFlag(ctx, {
                key: "new-dashboard-feature",
                distinctId: args.userId ?? args.anonymousId,
            });
            return { showNewFeature: Boolean(enabled) };
        }
        catch (error) {
            console.warn("Feature flag evaluation failed", error);
            return { showNewFeature: false };
        }
    },
});
export const profile = action({
    args: visitorArgs,
    handler: async (ctx, args) => {
        try {
            throw new Error("Profile data is unavailable");
        }
        catch (error) {
            await posthog.captureException(ctx, {
                error,
                distinctId: args.userId ?? args.anonymousId,
                additionalProperties: visitorProperties(args),
            });
            return { message: "Profile data is unavailable. The error was reported." };
        }
    },
});
