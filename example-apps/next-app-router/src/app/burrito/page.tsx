'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';

export default function BurritoPage() {
  const { user, isReady, incrementBurritoConsiderations } = useAuth();
  const router = useRouter();
  const [hasConsidered, setHasConsidered] = useState(false);

  // Redirect to home inside an effect once session restoration finishes if no user is logged in.
  useEffect(() => {
    if (isReady && !user) {
      router.push('/');
    }
  }, [isReady, user, router]);

  if (!user) {
    return null;
  }

  const handleConsideration = () => {
    const nextCount = user.burritoConsiderations + 1;
    incrementBurritoConsiderations();
    setHasConsidered(true);
    setTimeout(() => setHasConsidered(false), 2000);

    // Omit username and other PII from event properties. User attributes belong on identify() person properties.
    posthog.capture('burrito_considered', {
      total_considerations: nextCount,
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
