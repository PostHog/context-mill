import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { posthog } from '../lib/posthog-client'
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
  const [hasConsidered, setHasConsidered] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate({ to: '/' })
    }
  }, [user, navigate])

  if (!user) {
    return null
  }

  const handleConsideration = () => {
    incrementBurritoConsiderations()
    setHasConsidered(true)
    setTimeout(() => setHasConsidered(false), 2000)

    // Capture burrito consideration event
    posthog.capture('burrito_considered', {
      total_considerations: user.burritoConsiderations + 1,
      username: user.username,
    })
  }

  return (
    <main>
      <div className="container">
        <h1>Burrito consideration zone</h1>
        <p>Take a moment to truly consider the potential of burritos.</p>

        <div style={{ textAlign: 'center' }}>
          <button onClick={handleConsideration} className="btn-burrito">
            I have considered the burrito potential
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
