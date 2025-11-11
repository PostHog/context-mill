import { useNavigate } from 'react-router';
import { usePostHog } from 'posthog-js/react';
import type { Route } from "./+types/profile";
import { useAuth } from '../contexts/AuthContext';

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Profile - Burrito Consideration App" },
    { name: "description", content: "Your burrito consideration profile" },
  ];
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const posthog = usePostHog();

  // Redirect to home if not logged in
  if (!user) {
    navigate('/');
    return null;
  }

  const triggerTestError = () => {
    try {
      throw new Error('Test error for PostHog error tracking');
    } catch (err) {
      posthog.captureException(err);
      console.error('Captured error:', err);
      alert('Error captured and sent to PostHog!');
    }
  };

  return (
    <div className="container">
      <h1>User Profile</h1>

      <div className="stats">
        <h2>Your Information</h2>
        <p><strong>Username:</strong> {user.username}</p>
        <p><strong>Burrito Considerations:</strong> {user.burritoConsiderations}</p>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <button onClick={triggerTestError} className="btn-primary" style={{ backgroundColor: '#dc3545' }}>
          Trigger Test Error (for PostHog)
        </button>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h3>Your Burrito Journey</h3>
        {user.burritoConsiderations === 0 ? (
          <p>You haven't considered any burritos yet. Visit the Burrito Consideration page to start!</p>
        ) : user.burritoConsiderations === 1 ? (
          <p>You've considered the burrito potential once. Keep going!</p>
        ) : user.burritoConsiderations < 5 ? (
          <p>You're getting the hang of burrito consideration!</p>
        ) : user.burritoConsiderations < 10 ? (
          <p>You're becoming a burrito consideration expert!</p>
        ) : (
          <p>You are a true burrito consideration master! 🌯</p>
        )}
      </div>
    </div>
  );
}
