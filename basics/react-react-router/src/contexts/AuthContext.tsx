import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePostHog } from 'posthog-js/react';

interface User {
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

const users: Map<string, User> = new Map();

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use lazy initializer to read from localStorage only once on mount
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;

    const storedUsername = localStorage.getItem('currentUser');
    if (storedUsername) {
      const existingUser = users.get(storedUsername);
      if (existingUser) {
        return existingUser;
      }
    }

    return null;
  });
  const posthog = usePostHog();

  const login = async (username: string, password: string): Promise<boolean> => {
    if (!username || !password) {
      return false;
    }

    // Get or create user in local map
    let user = users.get(username);
    const isNewUser = !user;

    if (!user) {
      user = { username, burritoConsiderations: 0 };
      users.set(username, user);
    }

    setUser(user);
    localStorage.setItem('currentUser', username);

    // Identify user in PostHog using username as distinct ID
    posthog.identify(username, {
      username: username,
      isNewUser: isNewUser,
    });

    // Capture login event
    posthog.capture('user_logged_in', {
      username: username,
      isNewUser: isNewUser,
    });

    return true;
  };

  const logout = () => {
    // Capture logout event before resetting
    posthog.capture('user_logged_out');
    posthog.reset();

    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const incrementBurritoConsiderations = () => {
    if (user) {
      user.burritoConsiderations++;
      users.set(user.username, user);
      setUser({ ...user });
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
