import { action, mutation } from "./_generated/server"
import { v } from "convex/values"
import { posthog } from "./posthog"

// The demo has no auth provider, so the client passes its user id. In a real
// app, resolve the user id on the server (for example with ctx.auth) and use
// that as the distinctId.
const visitorArgs = {
    userId: v.optional(v.string()),
    anonymousId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
}

// Resolve an authenticated user id first, or a per-visit anonymous id with
// person profile creation disabled. Return null and omit analytics calls when
// both are missing instead of falling back to a shared literal like anonymous.
function resolveVisitor(args: { userId?: string; anonymousId?: string; sessionId?: string }): {
    distinctId: string
    properties: Record<string, unknown>
} | null {
    const sessionId = args.sessionId?.trim()
    const sessionProps = sessionId ? { $session_id: sessionId } : {}

    const userId = args.userId?.trim()
    if (userId) {
        return {
            distinctId: userId,
            properties: sessionProps,
        }
    }

    const anonymousId = args.anonymousId?.trim()
    if (anonymousId) {
        return {
            distinctId: anonymousId,
            properties: {
                $process_person_profile: false,
                ...sessionProps,
            },
        }
    }

    return null
}

export const login = mutation({
    args: { userId: v.string(), email: v.string(), sessionId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        // Skip identify and capture when user identity is blank rather than
        // inventing a fallback distinctId.
        const userId = args.userId.trim()
        const email = args.email.trim()
        if (!userId || !email) return

        const sessionId = args.sessionId?.trim()

        await posthog.identify(ctx, {
            distinctId: userId,
            properties: { email },
        })

        await posthog.capture(ctx, {
            distinctId: userId,
            event: "user_logged_in",
            properties: {
                login_method: "email",
                ...(sessionId ? { $session_id: sessionId } : {}),
            },
        })
    },
})

export const considerBurrito = mutation({
    args: { ...visitorArgs, totalConsiderations: v.number() },
    handler: async (ctx, args) => {
        const visitor = resolveVisitor(args)
        if (!visitor) return

        await posthog.capture(ctx, {
            distinctId: visitor.distinctId,
            event: "burrito_considered",
            properties: {
                total_considerations: args.totalConsiderations,
                ...visitor.properties,
            },
        })
    },
})

// Remote evaluation runs in an action and needs no personal API key. Queries
// can use the local getFeatureFlag() once POSTHOG_PERSONAL_API_KEY is set.
export const dashboard = action({
    args: visitorArgs,
    handler: async (ctx, args) => {
        const visitor = resolveVisitor(args)
        if (!visitor) return { showNewFeature: false }

        try {
            const enabled = await posthog.evaluateFlag(ctx, {
                key: "new-dashboard-feature",
                distinctId: visitor.distinctId,
            })
            return { showNewFeature: Boolean(enabled) }
        } catch (error) {
            console.warn("Feature flag evaluation failed", error)
            return { showNewFeature: false }
        }
    },
})

export const profile = action({
    args: visitorArgs,
    handler: async (ctx, args) => {
        try {
            throw new Error("Profile data is unavailable")
        } catch (error) {
            const visitor = resolveVisitor(args)
            if (visitor) {
                await posthog.captureException(ctx, {
                    error,
                    distinctId: visitor.distinctId,
                    additionalProperties: visitor.properties,
                })
            }
            return { message: "Profile data is unavailable. The error was reported." }
        }
    },
})
