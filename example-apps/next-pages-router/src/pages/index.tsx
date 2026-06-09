import { useState } from 'react';
import Head from 'next/head';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

export default function Home() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const success = await login(username, password);
      if (success) {
        setUsername('');
        setPassword('');
      } else {
        setError('Please provide both username and password');
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError('An error occurred during login');
    }
  };

  return (
    <>
      <Head>
        <title>Burrito Consideration App</title>
        <meta name="description" content="Consider the potential of burritos" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Header />
      <main>
        {user ? (
          <div className="container">
            <h1>Welcome back, {user.username}!</h1>
            <p>You are now logged in. Feel free to explore:</p>
            <ul>
              <li>Consider the potential of burritos</li>
              <li>View your profile and statistics</li>
            </ul>
          </div>
        ) : (
          <div className="container">
            <h1>Welcome to Burrito Consideration App</h1>
            <p>Please sign in to begin your burrito journey</p>

            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="username">Username:</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter any username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter any password"
                />
              </div>

              {error && <p className="error">{error}</p>}

              <button type="submit" className="btn-primary">Sign In</button>
            </form>

            <p className="note">
              Note: This is a demo app. Use any username and password to sign in.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
