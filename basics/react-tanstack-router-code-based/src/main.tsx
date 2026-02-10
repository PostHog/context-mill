import { StrictMode, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { PostHogProvider, usePostHog } from '@posthog/react'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import './styles.css'
import reportWebVitals from './reportWebVitals'

// ============================================================================
// Root Route
// ============================================================================

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <PostHogProvider
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY!}
      options={{
        api_host: '/ingest',
        ui_host:
          import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com',
        defaults: '2026-01-30',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      <AuthProvider>
        <Header />
        <main>
          <Outlet />
        </main>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      </AuthProvider>
    </PostHogProvider>
  )
}

// ============================================================================
// Header Component
// ============================================================================

function Header() {
  const { user, logout } = useAuth()

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
              <button onClick={logout} className="btn-logout">
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

// ============================================================================
// Index Route (Home Page)
// ============================================================================

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

function Home() {
  const { user, login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const success = await login(username, password)
      if (success) {
        setUsername('')
        setPassword('')
      } else {
        setError('Please provide both username and password')
      }
    } catch (err) {
      console.error('Login failed:', err)
      setError('An error occurred during login')
    }
  }

  if (user) {
    return (
      <div className="container">
        <h1>Welcome back, {user.username}!</h1>
        <p>You are now logged in. Feel free to explore:</p>
        <ul>
          <li>Consider the potential of burritos</li>
          <li>View your profile and statistics</li>
        </ul>
      </div>
    )
  }

  return (
    <div className="container">
      <h1>Welcome to Burrito Consideration App</h1>
      <p>Please sign in to begin your burrito journey</p>

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter any username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter any password"
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-primary">
          Sign In
        </button>
      </form>

      <p className="note">
        Note: This is a demo app. Use any username and password to sign in.
      </p>
    </div>
  )
}

// ============================================================================
// Burrito Route
// ============================================================================

const burritoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/burrito',
  component: BurritoPage,
})

function BurritoPage() {
  const { user, incrementBurritoConsiderations } = useAuth()
  const navigate = useNavigate()
  const posthog = usePostHog()
  const [hasConsidered, setHasConsidered] = useState(false)

  // Redirect to home if not logged in
  if (!user) {
    navigate({ to: '/' })
    return null
  }

  const handleConsideration = () => {
    incrementBurritoConsiderations()
    setHasConsidered(true)
    setTimeout(() => setHasConsidered(false), 2000)

    // Capture burrito consideration event
    console.log('posthog', posthog)
    posthog.capture('burrito_considered', {
      total_considerations: user.burritoConsiderations + 1,
      username: user.username,
    })
  }

  return (
    <div className="container">
      <h1>Burrito consideration zone</h1>
      <p>Take a moment to truly consider the potential of burritos.</p>

      <div style={{ textAlign: 'center' }}>
        <button onClick={handleConsideration} className="btn-burrito">
          I have considered the burrito potential
        </button>

        {hasConsidered && (
          <p className="success">
            Thank you for your consideration! Count: {user.burritoConsiderations}
          </p>
        )}
      </div>

      <div className="stats">
        <h3>Consideration stats</h3>
        <p>Total considerations: {user.burritoConsiderations}</p>
      </div>
    </div>
  )
}

// ============================================================================
// Profile Route
// ============================================================================

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
})

function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const posthog = usePostHog()

  // Redirect to home if not logged in
  if (!user) {
    navigate({ to: '/' })
    return null
  }

  const triggerTestError = () => {
    try {
      throw new Error('Test error for PostHog error tracking')
    } catch (err) {
      posthog.captureException(err)
      console.error('Captured error:', err)
      alert('Error captured and sent to PostHog!')
    }
  }

  return (
    <div className="container">
      <h1>User Profile</h1>

      <div className="stats">
        <h2>Your Information</h2>
        <p>
          <strong>Username:</strong> {user.username}
        </p>
        <p>
          <strong>Burrito Considerations:</strong> {user.burritoConsiderations}
        </p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={triggerTestError}
          className="btn-primary"
          style={{ backgroundColor: '#dc3545' }}
        >
          Trigger Test Error (for PostHog)
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Your Burrito Journey</h3>
        {user.burritoConsiderations === 0 ? (
          <p>
            You haven't considered any burritos yet. Visit the Burrito
            Consideration page to start!
          </p>
        ) : user.burritoConsiderations === 1 ? (
          <p>You've considered the burrito potential once. Keep going!</p>
        ) : user.burritoConsiderations < 5 ? (
          <p>You're getting the hang of burrito consideration!</p>
        ) : user.burritoConsiderations < 10 ? (
          <p>You're becoming a burrito consideration expert!</p>
        ) : (
          <p>You are a true burrito consideration master!</p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Route Tree & Router Setup
// ============================================================================

const routeTree = rootRoute.addChildren([indexRoute, burritoRoute, profileRoute])

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// ============================================================================
// Render the App
// ============================================================================

const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
