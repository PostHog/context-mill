'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import posthog from 'posthog-js';

interface User {
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const users: Map<string, User> = new Map();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('currentUser');
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<User>;
        // Only restore and re-identify when a complete persisted user record with a stable id is present.
        if (
          typeof parsed?.id === 'string' &&
          parsed.id &&
          typeof parsed?.username === 'string' &&
          parsed.username.trim()
        ) {
          const restoredUser: User = {
            id: parsed.id,
            username: parsed.username.trim(),
            burritoConsiderations:
              typeof parsed.burritoConsiderations === 'number'
                ? parsed.burritoConsiderations
                : 0,
          };
          users.set(restoredUser.username, restoredUser);
          setUser(restoredUser);
          posthog.identify(restoredUser.id, {
            username: restoredUser.username,
          });
        } else {
          localStorage.removeItem('currentUser');
        }
      } catch {
        localStorage.removeItem('currentUser');
      }
    }
    setIsReady(true);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const trimmedUsername = username.trim();
    // Reject blank credentials before calling the login endpoint or PostHog.
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

        let localUser = users.get(trimmedUsername);
        if (!localUser) {
          localUser = userData as User;
          users.set(trimmedUsername, localUser);
        }

        setUser(localUser);
        localStorage.setItem('currentUser', JSON.stringify(localUser));

        posthog.identify(localUser.id, {
          username: localUser.username,
        });

        // Omit username and other PII from event properties. Send only safe non-PII login context.
        posthog.capture('user_logged_in', {
          login_method: 'username',
        });

        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    // Only capture logout and reset PostHog when signing out of an authenticated session.
    if (!user) return;

    posthog.capture('user_logged_out');
    posthog.reset();

    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const incrementBurritoConsiderations = () => {
    if (user) {
      const updatedUser: User = {
        ...user,
        burritoConsiderations: user.burritoConsiderations + 1,
      };
      users.set(updatedUser.username, updatedUser);
      setUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isReady, login, logout, incrementBurritoConsiderations }}
    >
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
