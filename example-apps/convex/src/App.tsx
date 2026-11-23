import { useState } from "react"
import { useAction, useMutation } from "convex/react"
import { usePostHog } from "@posthog/react"
import { api } from "../convex/_generated/api"

export default function App() {
    const posthog = usePostHog()
    const login = useMutation(api.burrito.login)
    const considerBurrito = useMutation(api.burrito.considerBurrito)
    const dashboard = useAction(api.burrito.dashboard)
    const profile = useAction(api.burrito.profile)

    const [userId, setUserId] = useState<string | null>(null)
    const [count, setCount] = useState(0)
    const [message, setMessage] = useState("")

    // Backend functions identify the visitor with the same id the browser uses.
    // Signed-out visitors send posthog-js's random id for the visit.
    const visitor = () => ({
        userId: userId ?? undefined,
        anonymousId: posthog.get_distinct_id(),
        sessionId: posthog.get_session_id(),
    })

    async function handleLogin(formData: FormData) {
        const id = String(formData.get("userId"))
        const email = String(formData.get("email"))

        posthog.identify(id, { email })
        await login({ userId: id, email, sessionId: posthog.get_session_id() })
        setUserId(id)
    }

    function handleLogout() {
        posthog.reset()
        setUserId(null)
    }

    async function handleBurrito() {
        const next = count + 1
        setCount(next)
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
            {userId ? (
                <p>
                    Signed in as <strong>{userId}</strong> <button onClick={handleLogout}>Log out</button>
                </p>
            ) : (
                <form action={handleLogin}>
                    <label>
                        User id <input name="userId" defaultValue="burrito-fan-42" />
                    </label>
                    <label>
                        Email <input name="email" defaultValue="fan@example.com" />
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
