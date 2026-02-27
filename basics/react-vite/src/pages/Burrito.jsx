import { useAuth } from '../contexts/AuthContext'
import { usePostHog } from '@posthog/react'

export default function Burrito() {
  const { user, setUser } = useAuth()
  const posthog = usePostHog()

  if (!user) return null

  const handleConsider = () => {
    const updatedUser = {
      ...user,
      burritoConsiderations: user.burritoConsiderations + 1,
    }
    setUser(updatedUser)

    posthog.capture('burrito_considered', {
      total_considerations: updatedUser.burritoConsiderations,
    })
  }

  return (
    <div className="container">
      <h1>Burrito Consideration Zone</h1>

      <div className="burrito-stats">
        <p>Times considered: <strong>{user.burritoConsiderations}</strong></p>
        <button onClick={handleConsider} className="btn-burrito">
          Consider a Burrito
        </button>
      </div>

      <div className="burrito-info">
        <h2>Why Consider Burritos?</h2>
        <ul>
          <li>They are delicious</li>
          <li>They are portable</li>
          <li>They contain multiple food groups</li>
          <li>They bring joy</li>
        </ul>
      </div>
    </div>
  )
}
