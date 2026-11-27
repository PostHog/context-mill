import { useEffect, useState } from "react"
import { useAction, useMutation } from "convex/react"
import { usePostHog } from "@posthog/react"
import { api } from "../convex/_generated/api"

const VISIT_ID_KEY = "demo-visit-id"
const SESSION_USER_KEY = "demo-current-user"

interface StoredUser {
    userId: string
    email: string
    burritoConsiderations: number
}

// Keep a stable per-visit UUID in sessionStorage when posthog-js is not
// configured, so Convex functions never receive undefined or a shared string.
function getOrCreateVisitId(): string {
    let id = sessionStorage.getItem(VISIT_ID_KEY)
    if (!id) {
        id = crypto.randomUUID()
        sessionStorage.setItem(VISIT_ID_KEY, id)
    }
    return id
}

function getOrCreateUserId(email: string): string {
    const key = `demo-user-id:${email.toLowerCase()}`
    let id = localStorage.getItem(key)
    if (!id) {
        id = crypto.randomUUID()
        localStorage.setItem(key, id)
    }
    return id
}

function loadStoredUser(): StoredUser | null {
    try {
        const raw = localStorage.getItem(SESSION_USER_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<StoredUser>
        if (typeof parsed.userId === "string" && parsed.userId && typeof parsed.email === "string" && parsed.email) {
            return {
                userId: parsed.userId,
                email: parsed.email,
                burritoConsiderations: typeof parsed.burritoConsiderations === "number" ? parsed.burritoConsiderations : 0,
            }
        }
    } catch {
        // Ignore malformed localStorage entries.
    }
    return null
}

export default function App() {
    const rawPostHog = usePostHog()
    const posthog = rawPostHog?.__loaded ? rawPostHog : undefined

    const login = useMutation(api.burrito.login)
    const considerBurrito = useMutation(api.burrito.considerBurrito)
    const dashboard = useAction(api.burrito.dashboard)
    const profile = useAction(api.burrito.profile)

    const [sessionUser, setSessionUser] = useState<StoredUser | null>(() => loadStoredUser())
    const [count, setCount] = useState<number>(() => loadStoredUser()?.burritoConsiderations ?? 0)
    const [message, setMessage] = useState("")

    // Re-identify on page reload when a signed-in user session is restored.
    useEffect(() => {
        const stored = loadStoredUser()
        if (stored) {
            posthog?.identify(stored.userId, { email: stored.email })
        }
    }, [posthog])

    // Backend functions identify the visitor with the same id the browser uses.
    const visitor = () => ({
        userId: sessionUser?.userId,
        anonymousId: posthog?.get_distinct_id() || getOrCreateVisitId(),
        sessionId: posthog?.get_session_id() || undefined,
    })

    async function handleLogin(formData: FormData) {
        // Require a non-empty email instead of falling back to a placeholder id,
        // and skip identify and login when identity is missing.
        const email = String(formData.get("email") ?? "").trim()
        if (!email) {
            setMessage("Enter an email address to log in.")
            return
        }

        const userId = getOrCreateUserId(email)
        const nextUser: StoredUser = { userId, email, burritoConsiderations: count }
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(nextUser))
        setSessionUser(nextUser)

        posthog?.identify(userId, { email })
        await login({ userId, email, sessionId: posthog?.get_session_id() || undefined })
        setMessage("")
    }

    function handleLogout() {
        if (!sessionUser) return
        posthog?.capture("user_logged_out")
        posthog?.reset()
        sessionStorage.removeItem(VISIT_ID_KEY)
        localStorage.removeItem(SESSION_USER_KEY)
        setSessionUser(null)
        setCount(0)
    }

    async function handleBurrito() {
        const next = count + 1
        setCount(next)
        if (sessionUser) {
            const updated: StoredUser = { ...sessionUser, burritoConsiderations: next }
            localStorage.setItem(SESSION_USER_KEY, JSON.stringify(updated))
            setSessionUser(updated)
        }
        await considerBurrito({ ...visitor(), totalConsiderations: next })
        setMessage(`You have considered a burrito ${next} time(s).`)
    }

    async function handleDashboard() {
        const { showNewFeature } = await dashboard(visitor())
        setMessage(showNewFeature ? "You are seeing the new dashboard feature." : "You are seeing the standard dashboard.")
    }

    async function handleProfile() {
        const result = await profile(visitor())
        setMessage(result.message)
    }

    return (
        <main>
            <h1>Burrito app</h1>
            {sessionUser ? (
                <p>
                    Signed in as <strong>{sessionUser.email}</strong> <button onClick={handleLogout}>Log out</button>
                </p>
            ) : (
                <form action={handleLogin}>
                    <label>
                        Email <input name="email" type="email" placeholder="fan@example.com" required />
                    </label>
                    <button>Log in</button>
                </form>
            )}
            <p>
                <button onClick={handleBurrito}>Consider a burrito</button>
                <button onClick={handleDashboard}>Dashboard</button>
                <button onClick={handleProfile}>Profile</button>
            </p>
            <p>{message}</p>
        </main>
    )
}
