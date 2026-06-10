import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { usePostHog } from '@posthog/react';

export default function BurritoPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [hasConsidered, setHasConsidered] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleConsideration = () => {
    // Client-side only - no server calls
    const updatedUser = {
      ...user,
      burritoConsiderations: user.burritoConsiderations + 1
    };
    setUser(updatedUser);
    setHasConsidered(true);
    setTimeout(() => setHasConsidered(false), 2000);
    
    // Capture burrito consideration event
    posthog?.capture('burrito_considered', {
      total_considerations: updatedUser.burritoConsiderations,
      username: user.username,
    });
  };

  return (
    <div className="container">
      <h1>Burrito consideration zone</h1>
      <p>Take a moment to truly consider the potential of burritos.</p>

      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleConsideration}
          className="btn-burrito"
        >
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
  );
}
