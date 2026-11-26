import React, { useEffect, useState } from "react"
import Layout from "@theme/Layout"

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

export default function Burrito(): React.JSX.Element {
  const [username, setUsername] = useState("")
  const [user, setUser] = useState<string | null>(null)
  const [considerations, setConsiderations] = useState(0)
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem("currentUser")?.trim()
    // Skip session restore and identify when no signed-in user is stored in localStorage.
    if (!stored) return

    setUser(stored)
    window.posthog?.identify(getUserId(stored), { username: stored })
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = username.trim()
    // Reject blank usernames so we never call identify or capture login without a valid user identity.
    if (!trimmed) return

    window.localStorage.setItem("currentUser", trimmed)
    window.posthog?.identify(getUserId(trimmed), { username: trimmed })
    window.posthog?.capture("user_logged_in", { login_method: "username" })
    setUser(trimmed)
    setUsername("")
  }

  const handleLogout = () => {
    // Only capture logout and reset PostHog when signing out of an authenticated session.
    if (!user) return

    window.posthog?.capture("user_logged_out")
    window.posthog?.reset()
    window.localStorage.removeItem("currentUser")
    setUser(null)
    setConsiderations(0)
    setShowTip(false)
  }

  const handleConsider = () => {
    if (!user) return

    const nextCount = considerations + 1
    // Send only non-PII event metadata in capture() properties.
    window.posthog?.capture("burrito_considered", {
      total_considerations: nextCount,
    })
    setConsiderations(nextCount)
    setShowTip(window.posthog?.isFeatureEnabled("burrito-tip") === true)
  }

  const handleError = () => {
    try {
      throw new Error("Demo burrito error")
    } catch (err) {
      window.posthog?.captureException(err)
    }
  }

  return (
    <Layout title="Burrito demo">
      <main className="container margin-vert--lg">
        {user ? (
          <>
            <h1>Welcome, {user}</h1>
            <p>Burritos considered: {considerations}</p>
            {showTip && <p>Tip: consider the beans.</p>}
            <button className="button button--primary margin-right--sm" onClick={handleConsider}>
              Consider a burrito
            </button>
            <button className="button button--secondary margin-right--sm" onClick={handleError}>
              Trigger a test error
            </button>
            <button className="button button--link" onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <h1>Burrito demo</h1>
            <form onSubmit={handleLogin}>
              <label htmlFor="username">Username</label>{" "}
              <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />{" "}
              <button className="button button--primary" type="submit">
                Sign in
              </button>
            </form>
          </>
        )}
      </main>
    </Layout>
  )
}
