import { createContext, useContext, useEffect, useState } from "react";
import { usePostHog } from "@posthog/react";

// Stands in for your auth system, giving each username a stable UUID like a database primary key.
// Identify with that id, never with the username or email.
export function getUserId(username: string): string {
  const key = `demo-user-id:${username}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

const AuthContext = createContext<{
  user: string | null;
  setUser: (user: string | null) => void;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  const [user, setUserState] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("currentUser")?.trim();
    // Skip session restore and identify when no signed-in user is stored in localStorage.
    if (!saved) return;

    setUserState(saved);
    posthog?.identify(getUserId(saved), { username: saved });
  }, [posthog]);

  const setUser = (nextUser: string | null) => {
    const trimmed = nextUser?.trim() || null;
    setUserState(trimmed);
    if (trimmed) {
      window.localStorage.setItem("currentUser", trimmed);
    } else {
      window.localStorage.removeItem("currentUser");
    }
  };

  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
