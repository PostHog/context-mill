import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePostHog } from '@posthog/react';

export default function Header() {
  const { user, logout } = useAuth();
  const posthog = usePostHog();

  const handleLogout = () => {
    if (user) {
      posthog.capture('user_logged_out', {
        username: user.username,
        distinct_id: user.username,
      });
    }
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

