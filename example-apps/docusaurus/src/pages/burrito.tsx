import React, { useState } from "react"
import Layout from "@theme/Layout"

// Stands in for your auth system: each username gets a stable user id, the way a user
// record's primary key would. Identify with that id, never with the username or email.
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username) return

    window.posthog?.identify(getUserId(username), { username })
    window.posthog?.capture("user_logged_in")
    setUser(username)
    setUsername("")
  }

  const handleLogout = () => {
    window.posthog?.reset()
    setUser(null)
    setConsiderations(0)
  }

  const handleConsider = () => {
    window.posthog?.capture("burrito_considered", {
      total_considerations: considerations + 1,
    })
    setConsiderations(considerations + 1)
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
