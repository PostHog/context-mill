import { useAuth } from '../contexts/AuthContext'
import { usePostHog } from '@posthog/react'

export default function Header() {
  const { user, logout, page, setPage } = useAuth()
  const posthog = usePostHog()

  const handleLogout = () => {
    if (user) {
      posthog.capture('user_logged_out', {
        username: user.username,
      })
    }
    logout()
    posthog.reset()
  }

  const navigate = (target) => {
    setPage(target)
    posthog.capture('$pageview', { $current_url: `/${target}` })
  }

  return (
    <header className="header">
      <div className="header-container">
        <nav>
          <button onClick={() => navigate('home')} className={page === 'home' ? 'active' : ''}>
            Home
          </button>
          {user && (
            <>
              <button onClick={() => navigate('burrito')} className={page === 'burrito' ? 'active' : ''}>
                Burrito Consideration
              </button>
              <button onClick={() => navigate('profile')} className={page === 'profile' ? 'active' : ''}>
                Profile
              </button>
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
  )
}
