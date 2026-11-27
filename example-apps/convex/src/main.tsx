import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import posthog from "posthog-js"
import { PostHogProvider } from "@posthog/react"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import App from "./App"

// Leave the client uninitialized and omit PostHogProvider when VITE_POSTHOG_PROJECT_TOKEN is
// unset rather than initializing the SDK with an empty or placeholder key.
const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN?.trim()

if (posthogToken) {
    posthog.init(posthogToken, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
        defaults: "2026-08-30",
    })
} else if (import.meta.env.DEV) {
    console.error(
        "VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured"
    )
}

const convexUrl = import.meta.env.VITE_CONVEX_URL?.trim()
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

const appTree = convex ? (
    <ConvexProvider client={convex}>
        <App />
    </ConvexProvider>
) : (
    <p>VITE_CONVEX_URL is not set. Run `npx convex dev` to create a deployment.</p>
)

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        {posthogToken ? <PostHogProvider client={posthog}>{appTree}</PostHogProvider> : appTree}
    </StrictMode>
)
