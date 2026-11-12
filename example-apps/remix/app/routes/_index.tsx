import { useState } from "react";
import { usePostHog } from "@posthog/react";
import type { MetaFunction } from "@remix-run/node";

import { useAuth } from "../auth";

// Stands in for your auth system: each username gets a stable user id, the way a user
// record's primary key would. Identify with that id, never with the username or email.
function getUserId(username: string): string {
  const key = `demo-user-id:${username}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

export const meta: MetaFunction = () => [{ title: "Burrito consideration app" }];

export default function Index() {
  const { user, setUser } = useAuth();
  const posthog = usePostHog();
  const [username, setUsername] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    posthog.identify(getUserId(username), { username });
    posthog.capture("user_logged_in");
    setUser(username);
    setUsername("");
  };

  const handleLogout = () => {
    posthog.reset();
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
