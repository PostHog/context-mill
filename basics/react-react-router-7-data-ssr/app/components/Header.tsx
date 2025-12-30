import { Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext.js';
import { usePostHog } from '@posthog/react';

export default function Header() {
  const { user, logout } = useAuth();
  // usePostHog returns undefined during SSR (when PHProvider client is undefined)
  // After hydration, it returns the actual PostHog client
  const posthog = usePostHog();

  const handleLogout = () => {
    posthog?.reset();
    logout();
  };

  return (
    <header className="header">
      <div className="header-container">
        <nav>
          <Link to="/">Home</Link>
          {user && (
            <>
              <Link to="/burrito">Burrito Consideration</Link>
              <Link to="/profile">Profile</Link>
            </>
          )}
        </nav>
        <div className="user-section">
          {user ? (
            <>
              <span>Welcome, {user.username}!</span>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </>
          ) : (
            <span>Not logged in</span>
          )}
        </div>
      </div>
    </header>
  );
}

