import * as React from "react"
import type { HeadFC, PageProps } from "gatsby"
import posthog from "posthog-js"

// Stands in for your auth system, giving each username a stable UUID like a database primary key.
// Identify with that id, never with the username or email.
function getUserId(username: string): string {
  const key = `demo-user-id:${username}`
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  window.localStorage.setItem(key, id)
  return id
}

const IndexPage: React.FC<PageProps> = () => {
  const [username, setUsername] = React.useState("")
  const [user, setUser] = React.useState<string | null>(null)
  const [considerations, setConsiderations] = React.useState(0)
  const [showTip, setShowTip] = React.useState(false)

  React.useEffect(() => {
    const saved = window.localStorage.getItem("currentUser")?.trim()
    // Skip session restore and identify when no saved user exists in localStorage.
    if (!saved) return

    setUser(saved)
    posthog.identify(getUserId(saved), { username: saved })
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = username.trim()
    // Reject blank usernames so we never call identify or capture login without a valid user identity.
    if (!trimmed) return

    window.localStorage.setItem("currentUser", trimmed)
    posthog.identify(getUserId(trimmed), { username: trimmed })
    posthog.capture("user_logged_in", { login_method: "username" })
    setUser(trimmed)
    setUsername("")
  }

  const handleLogout = () => {
    // Only capture logout and reset PostHog when signing out of an authenticated session.
    if (!user) return

    posthog.capture("user_logged_out")
    posthog.reset()
    window.localStorage.removeItem("currentUser")
    setUser(null)
    setConsiderations(0)
    setShowTip(false)
  }

  const handleConsider = () => {
    if (!user) return

    const nextCount = considerations + 1
    // Send only non-PII event metadata in capture() properties.
    posthog.capture("burrito_considered", {
      total_considerations: nextCount,
    })
    setConsiderations(nextCount)
    setShowTip(posthog.isFeatureEnabled("burrito-tip") === true)
  }

  const handleError = () => {
    try {
      throw new Error("Demo burrito error")
    } catch (err) {
      posthog.captureException(err)
    }
  }

  if (!user) {
    return (
      <main>
        <h1>Burrito consideration app</h1>
        <form onSubmit={handleLogin}>
          <label htmlFor="username">Username</label>{" "}
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />{" "}
          <button type="submit">Sign in</button>
        </form>
      </main>
    )
  }

  return (
    <main>
      <h1>Welcome, {user}</h1>
      <p>Burritos considered: {considerations}</p>
      {showTip && <p>Tip: consider the beans.</p>}
      <button onClick={handleConsider}>Consider a burrito</button>{" "}
      <button onClick={handleError}>Trigger a test error</button>{" "}
      <button onClick={handleLogout}>Sign out</button>
    </main>
  )
}

export default IndexPage

export const Head: HeadFC = () => <title>Burrito consideration app</title>
