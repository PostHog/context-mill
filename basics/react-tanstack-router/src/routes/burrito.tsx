import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePostHog } from 'posthog-js/react'
import { useAuth } from '../contexts/AuthContext'

export const Route = createFileRoute('/burrito')({
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
