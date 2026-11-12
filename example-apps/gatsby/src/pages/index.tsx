import * as React from "react"
import type { HeadFC, PageProps } from "gatsby"

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

const IndexPage: React.FC<PageProps> = () => {
  const [username, setUsername] = React.useState("")
  const [user, setUser] = React.useState<string | null>(null)
  const [considerations, setConsiderations] = React.useState(0)
  const [showTip, setShowTip] = React.useState(false)

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
