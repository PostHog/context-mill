import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import posthog from "posthog-js";
import { PostHogProvider } from "@posthog/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
if (posthogToken) {
    posthog.init(posthogToken, {
        api_host: import.meta.env.VITE_POSTHOG_HOST,
        defaults: "2026-08-30",
    });
}
else if (import.meta.env.DEV) {
    console.error("VITE_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_POSTHOG_PROJECT_TOKEN is configured");
}
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
createRoot(document.getElementById("root")).render(_jsx(StrictMode, { children: _jsx(PostHogProvider, { client: posthog, children: convex ? (_jsx(ConvexProvider, { client: convex, children: _jsx(App, {}) })) : (_jsx("p", { children: "VITE_CONVEX_URL is not set. Run `npx convex dev` to create a deployment." })) }) }));
