import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { usePostHog } from "@posthog/react";
import { api } from "../convex/_generated/api";
export default function App() {
    const posthog = usePostHog();
    const login = useMutation(api.burrito.login);
    const considerBurrito = useMutation(api.burrito.considerBurrito);
    const dashboard = useAction(api.burrito.dashboard);
    const profile = useAction(api.burrito.profile);
    const [userId, setUserId] = useState(null);
    const [count, setCount] = useState(0);
    const [message, setMessage] = useState("");
    // Backend functions identify the visitor with the same id the browser uses.
    // Signed-out visitors send posthog-js's random id for the visit.
    const visitor = () => ({
        userId: userId ?? undefined,
        anonymousId: posthog.get_distinct_id(),
        sessionId: posthog.get_session_id(),
    });
    async function handleLogin(formData) {
        const id = String(formData.get("userId"));
        const email = String(formData.get("email"));
        posthog.identify(id, { email });
        await login({ userId: id, email, sessionId: posthog.get_session_id() });
        setUserId(id);
    }
    function handleLogout() {
        posthog.reset();
        setUserId(null);
    }
    async function handleBurrito() {
        const next = count + 1;
        setCount(next);
        await considerBurrito({ ...visitor(), totalConsiderations: next });
        setMessage(`You have considered a burrito ${next} time(s).`);
    }
    async function handleDashboard() {
        const { showNewFeature } = await dashboard(visitor());
        setMessage(showNewFeature ? "You are seeing the new dashboard feature." : "You are seeing the standard dashboard.");
    }
    async function handleProfile() {
        const result = await profile(visitor());
        setMessage(result.message);
    }
    return (_jsxs("main", { children: [_jsx("h1", { children: "Burrito app" }), userId ? (_jsxs("p", { children: ["Signed in as ", _jsx("strong", { children: userId }), " ", _jsx("button", { onClick: handleLogout, children: "Log out" })] })) : (_jsxs("form", { action: handleLogin, children: [_jsxs("label", { children: ["User id ", _jsx("input", { name: "userId", defaultValue: "burrito-fan-42" })] }), _jsxs("label", { children: ["Email ", _jsx("input", { name: "email", defaultValue: "fan@example.com" })] }), _jsx("button", { children: "Log in" })] })), _jsxs("p", { children: [_jsx("button", { onClick: handleBurrito, children: "Consider a burrito" }), _jsx("button", { onClick: handleDashboard, children: "Dashboard" }), _jsx("button", { onClick: handleProfile, children: "Profile" })] }), _jsx("p", { children: message })] }));
}
