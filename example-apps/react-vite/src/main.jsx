import './globals.css'

import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import posthog from 'posthog-js'
import { PostHogErrorBoundary, PostHogProvider } from '@posthog/react'

// Read the project token without a fallback value. When it is missing, leave the client uninitialized()
// and PostHogProvider rather than initializing the SDK with a placeholder key.
const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: '2026-08-30',
  })
} else if (import.meta.env.DEV) {
  console.error('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured')
}

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

const app = <App />

ReactDOM.createRoot(root).render(
  <StrictMode>
    {posthogToken ? (
      <PostHogProvider client={posthog}>
        <PostHogErrorBoundary>{app}</PostHogErrorBoundary>
      </PostHogProvider>
    ) : (
      app
    )}
  </StrictMode>,
)
