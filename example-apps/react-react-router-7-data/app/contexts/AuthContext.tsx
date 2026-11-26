import { usePostHog } from '@posthog/react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  burritoConsiderations: number;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
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
  const posthog = usePostHog();
  const [user, setUser] = useState<User | null>(() => readCurrentUser());
  const initialUserRef = useRef(user);

  useEffect(() => {
    const restoredUser = initialUserRef.current;
    // Re-identify with the stored stable user ID when restoring an authenticated session.
    // Skip identify when no stored session exists rather than using a fallback ID.
    if (restoredUser) {
      posthog?.identify(restoredUser.id, { username: restoredUser.username });
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

    // Identify on login as well as on session restore using the stable UUID primary key,
    // sending username only as a person property.
    posthog?.identify(localUser.id, { username: localUser.username });
    // Keep PII such as username out of event properties.
    posthog?.capture('user_logged_in', { is_new_user: isNewUser });

    return true;
  };

  const logout = () => {
    setUser(null);
    window.localStorage.removeItem(CURRENT_USER_KEY);
  };

  const setUserState = (newUser: User) => {
    setUser(newUser);
    saveDemoUser(newUser);
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, setUser: setUserState }}>
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
