import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePostHog } from '@posthog/react';

export interface User {
  id: string;
  username: string;
  burritoConsiderations: number;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  incrementBurritoConsiderations: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = 'currentUser';
const DEMO_USERS_KEY = 'demoUsers';

function isValidStoredUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.username === 'string' &&
    candidate.username.trim().length > 0 &&
    typeof candidate.burritoConsiderations === 'number'
  );
}

function readDemoUsers(): Record<string, User> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DEMO_USERS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, User>) : {};
  } catch {
    return {};
  }
}

function saveDemoUser(user: User): void {
  if (typeof window === 'undefined') return;
  const users = readDemoUsers();
  users[user.username] = user;
  window.localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
}

function readCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidStoredUser(parsed)) return null;
    return {
      id: parsed.id.trim(),
      username: parsed.username.trim(),
      burritoConsiderations: parsed.burritoConsiderations,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCurrentUser());
  const initialUserRef = useRef(user);
  const posthog = usePostHog();

  useEffect(() => {
    const restoredUser = initialUserRef.current;
    // Re-identify with the stored stable user ID when restoring an authenticated session.
    // Skip identify when no stored session exists rather than using a fallback ID.
    if (!restoredUser) return;

    const identifyRestoredUser = () => {
      posthog?.identify(restoredUser.id, { username: restoredUser.username });
    };

    if ((posthog as { __loaded?: boolean } | undefined)?.__loaded === false) {
      queueMicrotask(identifyRestoredUser);
    } else {
      identifyRestoredUser();
    }
  }, [posthog]);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Trim username and reject blank credentials so we never identify or capture with an empty ID.
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      return false;
    }

    const demoUsers = readDemoUsers();
    const existingUser = demoUsers[trimmedUsername];
    const isNewUser = !isValidStoredUser(existingUser);

    const localUser: User = isNewUser
      ? {
          id: crypto.randomUUID(),
          username: trimmedUsername,
          burritoConsiderations: 0,
        }
      : {
          id: existingUser.id.trim(),
          username: trimmedUsername,
          burritoConsiderations: existingUser.burritoConsiderations,
        };

    saveDemoUser(localUser);
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(localUser));
    setUser(localUser);

    // Identify with the stable UUID primary key and pass username only as a person property.
    posthog?.identify(localUser.id, { username: localUser.username });

    // Capture login event without PII such as username in event properties.
    posthog?.capture('user_logged_in', {
      is_new_user: isNewUser,
    });

    return true;
  };

  const logout = () => {
    // Only capture logout and reset PostHog when logging out of an authenticated session.
    if (user) {
      posthog?.capture('user_logged_out');
      posthog?.reset();
    }

    setUser(null);
    window.localStorage.removeItem(CURRENT_USER_KEY);
  };

  const incrementBurritoConsiderations = () => {
    if (user) {
      const updatedUser: User = {
        ...user,
        burritoConsiderations: user.burritoConsiderations + 1,
      };
      saveDemoUser(updatedUser);
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, incrementBurritoConsiderations }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
