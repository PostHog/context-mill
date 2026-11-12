import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { PostHogProvider } from '@posthog/react'

import Header from '../components/Header'
import { AuthProvider } from '../contexts/AuthContext'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN

if (!posthogToken && import.meta.env.DEV) {
  console.warn(
    'VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. PostHog is disabled.',
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const app = (
    <AuthProvider>
      <Header />
      {children}
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

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {posthogToken ? (
          <PostHogProvider
            apiKey={posthogToken}
            options={{
              api_host: '/ingest',
              ui_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.includes('eu.') ? 'https://eu.posthog.com' : 'https://us.posthog.com', // The PostHog app for your region
              defaults: '2026-08-30',
              capture_exceptions: true,
              debug: import.meta.env.DEV,
              // Automatically add X-POSTHOG-SESSION-ID and X-POSTHOG-DISTINCT-ID
              // headers to same-origin requests so server-side events join the
              // same session. Guarded for SSR, where `window` is undefined.
              tracing_headers:
                typeof window !== 'undefined' ? [window.location.hostname] : [],
            }}
          >
            {app}
          </PostHogProvider>
        ) : (
          app
        )}
        <Scripts />
      </body>
    </html>
  )
}
