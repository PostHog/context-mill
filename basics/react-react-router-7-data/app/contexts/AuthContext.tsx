import { usePostHog } from '@posthog/react';
import { createContext, useContext, useState, type ReactNode } from 'react';

interface User {
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

const users: Map<string, User> = new Map();

export function AuthProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();
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

  const login = async (username: string, password: string): Promise<boolean> => {
    // Client-side only fake auth - no server calls
    if (!username || !password) {
      return false;
    }

    let localUser = users.get(username);
    if (!localUser) {
      localUser = { 
        username, 
        burritoConsiderations: 0 
      };
      users.set(username, localUser);
    }

    setUser(localUser);
    localStorage.setItem('currentUser', username);
    
    posthog.identify(username);
    posthog.capture('user_logged_in');

    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('currentUser');
  };

  const setUserState = (newUser: User) => {
    setUser(newUser);
    users.set(newUser.username, newUser);
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
