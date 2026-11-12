import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { PostHogProvider } from '@posthog/react'

import Header from '../components/Header'
import { AuthProvider } from '../contexts/AuthContext'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN

if (!posthogToken && import.meta.env.DEV) {
  console.warn(
    'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.',
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
