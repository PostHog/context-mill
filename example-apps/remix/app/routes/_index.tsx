import { useState } from "react";
import { usePostHog } from "@posthog/react";
import type { MetaFunction } from "@remix-run/node";

import { getUserId, useAuth } from "../auth";

export const meta: MetaFunction = () => [{ title: "Burrito consideration app" }];

export default function Index() {
  const { user, setUser } = useAuth();
  const posthog = usePostHog();
  const [username, setUsername] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    // Reject blank usernames so we never call identify or capture login without a valid user identity.
    if (!trimmed) return;

    posthog?.identify(getUserId(trimmed), { username: trimmed });
    posthog?.capture("user_logged_in", { login_method: "username" });
    setUser(trimmed);
    setUsername("");
  };

  const handleLogout = () => {
    // Only capture logout and reset PostHog when signing out of an authenticated session.
    if (!user) return;

    posthog?.capture("user_logged_out");
    posthog?.reset();
    setUser(null);
  };

  if (user) {
    return (
      <main>
        <h1>Welcome back, {user}</h1>
        <button onClick={handleLogout}>Sign out</button>
      </main>
    );
  }

  return (
    <main>
      <h1>Burrito consideration app</h1>
      <form onSubmit={handleLogin}>
        <label htmlFor="username">Username</label>{" "}
        <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />{" "}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
