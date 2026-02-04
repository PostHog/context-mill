import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { usePostHog } from '@posthog/react'
import { useAuth } from '../contexts/AuthContext'

export const Route = createFileRoute('/burrito')({
  component: BurritoPage,
  head: () => ({
    meta: [
      {
        title: 'Burrito Consideration - Burrito Consideration App',
      },
      {
        name: 'description',
        content: 'Consider the potential of burritos',
      },
    ],
  }),
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

  const handleClientConsideration = () => {
    incrementBurritoConsiderations()
    setHasConsidered(true)
    setTimeout(() => setHasConsidered(false), 2000)

    posthog.capture('burrito_considered', {
      total_considerations: user.burritoConsiderations + 1,
      username: user.username,
    })
  }

  const handleServerConsideration = async () => {
    incrementBurritoConsiderations()
    setHasConsidered(true)
    setTimeout(() => setHasConsidered(false), 2000)

    await fetch('/api/burrito/consider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: user.username,
        totalConsiderations: user.burritoConsiderations + 1,
      }),
    })
  }

  return (
    <main>
      <div className="container">
        <h1>Burrito consideration zone</h1>
        <p>Take a moment to truly consider the potential of burritos.</p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem' }}>
          <button
            onClick={handleClientConsideration}
            className="btn-burrito"
            style={{ backgroundColor: '#e07c24', color: '#fff' }}
          >
            Consider burrito (client)
          </button>
          <button
            onClick={handleServerConsideration}
            className="btn-burrito"
            style={{ backgroundColor: '#4a90d9', color: '#fff' }}
          >
            Consider burrito (server)
          </button>

          {hasConsidered && (
            <p className="success">
              Thank you for your consideration! Count:{' '}
              {user.burritoConsiderations}
            </p>
          )}
        </div>

        <div className="stats">
          <h3>Consideration stats</h3>
          <p>Total considerations: {user.burritoConsiderations}</p>
        </div>
      </div>
    </main>
  )
}
