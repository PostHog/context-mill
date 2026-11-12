import { createFileRoute } from '@tanstack/react-router'

// Proxy to the region in VITE_PUBLIC_POSTHOG_HOST: us.i.posthog.com or eu.i.posthog.com
const API_HOST = new URL(
  process.env.VITE_PUBLIC_POSTHOG_HOST ||
    import.meta.env.VITE_PUBLIC_POSTHOG_HOST ||
    'https://us.i.posthog.com',
).hostname
const ASSET_HOST = API_HOST.replace('.i.posthog.com', '-assets.i.posthog.com')

async function proxyToPostHog({ request }: { request: Request }) {
  const url = new URL(request.url)
  const pathname = url.pathname.replace(/^\/ingest/, '')
  const hostname =
    pathname.startsWith('/static/') || pathname.startsWith('/array/')
      ? ASSET_HOST
      : API_HOST

  url.protocol = 'https:'
  url.hostname = hostname
  url.port = '443'
  url.pathname = pathname

  const headers = new Headers(request.headers)
  headers.set('host', hostname)
  // Remove cookies before forwarding to PostHog
  headers.delete('cookie')
  // Forward PostHog keys (Bearer phc_, phs_ or phx_), which the SDKs need. Strip any other credentials.
  if (!/^Bearer ph[csx]_/.test(headers.get('authorization') ?? '')) {
    headers.delete('authorization')
  }
  headers.set('accept-encoding', '')

  return fetch(url, {
    method: request.method,
    headers,
    body: request.body,
    // @ts-expect-error - duplex is required for streaming request bodies
    duplex: 'half',
  })
}

export const Route = createFileRoute('/ingest/$')({
  server: {
    handlers: {
      GET: proxyToPostHog,
      POST: proxyToPostHog,
    },
  },
})
