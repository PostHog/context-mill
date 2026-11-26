import { usePostHog } from '@posthog/react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface User {
  id: string;
  username: string;
  burritoConsiderations: number;
}

interface AuthContextType {
  user: User | null;
  isReady: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  incrementBurritoConsiderations: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CURRENT_USER_KEY = 'currentUser';

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
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const storedUser = readCurrentUser();
    // Re-identify with the stored stable user ID when restoring an authenticated session.
    // Skip identify when no stored session exists rather than using a fallback ID.
    if (storedUser) {
      setUser(storedUser);
      posthog?.identify(storedUser.id, { username: storedUser.username });
    }
    setIsReady(true);
  }, [posthog]);

  const login = async (username: string, password: string): Promise<boolean> => {
    // Trim username and reject blank credentials before calling the server or PostHog.
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      return false;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });

      if (response.ok) {
        const { user: userData } = await response.json();
        if (!isValidStoredUser(userData)) {
          return false;
        }

        const authenticatedUser: User = {
          id: userData.id.trim(),
          username: userData.username.trim(),
          burritoConsiderations: userData.burritoConsiderations,
        };

        setUser(authenticatedUser);
        window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authenticatedUser));

        // Identify with the stable UUID returned by the server, passing username only as a person property.
        posthog?.identify(authenticatedUser.id, { username: authenticatedUser.username });
        // Keep PII such as username out of event properties.
        posthog?.capture('user_logged_in', { login_method: 'username' });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    window.localStorage.removeItem(CURRENT_USER_KEY);
  };

  const incrementBurritoConsiderations = () => {
    if (user) {
      const updatedUser: User = {
        ...user,
        burritoConsiderations: user.burritoConsiderations + 1,
      };
      setUser(updatedUser);
      window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));
    }
  };

  const setUserState = (newUser: User) => {
    setUser(newUser);
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, isReady, login, logout, incrementBurritoConsiderations, setUser: setUserState }}>
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
