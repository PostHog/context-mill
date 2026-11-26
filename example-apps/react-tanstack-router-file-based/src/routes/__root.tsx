import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { PostHogProvider } from '@posthog/react'

import Header from '../components/Header'
import { AuthProvider } from '../contexts/AuthContext'

// Read the project token without a fallback value. When it is missing, render the app
// without PostHogProvider rather than initializing the SDK with a placeholder key.
const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim()

if (!posthogToken && import.meta.env.DEV) {
  console.error(
    'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured',
  )
}

function RootComponent() {
  const app = (
    <AuthProvider>
      <Header />
      <main>
        <Outlet />
      </main>
      <TanStackDevtools
        config={{
          position: 'bottom-right',
        }}
        plugins={[
          {
            name: 'Tanstack Router',
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </AuthProvider>
  )

  return posthogToken ? (
    <PostHogProvider
      apiKey={posthogToken}
      options={{
        api_host:
          import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
          'https://us.i.posthog.com',
        defaults: '2026-08-30',
        capture_exceptions: true,
        debug: import.meta.env.DEV,
      }}
    >
      {app}
    </PostHogProvider>
  ) : (
    app
  )
}

export const Route = createRootRoute({
  component: RootComponent,
})
