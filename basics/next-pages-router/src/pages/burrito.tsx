import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

export default function BurritoPage() {
  const { user, incrementBurritoConsiderations } = useAuth();
  const router = useRouter();
  const [hasConsidered, setHasConsidered] = useState(false);

  // Redirect to home if not logged in
  if (!user) {
    router.push('/');
    return null;
  }

  const handleConsideration = () => {
    incrementBurritoConsiderations();
    setHasConsidered(true);
    setTimeout(() => setHasConsidered(false), 2000);

    // Capture burrito consideration event
    posthog.capture('burrito_considered', {
      total_considerations: user.burritoConsiderations + 1,
      username: user.username,
    });
  };

  return (
    <>
      <Head>
        <title>Burrito Consideration - Burrito Consideration App</title>
        <meta name="description" content="Consider the potential of burritos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <main>
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
      </main>
    </>
  );
}
