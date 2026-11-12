export default defineEventHandler(async (event) => {
  const path = event.context.params?.path || ''
  const url = getRequestURL(event)
  const search = url.search || ''

  // Proxy to the region in NUXT_PUBLIC_POSTHOG_HOST: us.i.posthog.com or eu.i.posthog.com
  const apiHostname = new URL(process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').hostname
  const useAssetHost = path.startsWith('static/') || path.startsWith('array/')
  const hostname = useAssetHost
    ? apiHostname.replace('.i.posthog.com', '-assets.i.posthog.com')
    : apiHostname

  const targetUrl = `https://${hostname}/${path}${search}`

  // Forward headers, excluding ones that shouldn't be proxied
  const headers = new Headers()
  const excludedHeaders = ['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding', 'cookie']

  const requestHeaders = getRequestHeaders(event)
  for (const [key, value] of Object.entries(requestHeaders)) {
    const name = key.toLowerCase()
    // Forward PostHog keys (Bearer phc_, phs_ or phx_), which the SDKs need. Strip any other credentials.
    // To allow an older key without one of these prefixes, also match its exact 'Bearer <key>' value.
    const isNonBearerAuth = name === 'authorization' && !/^Bearer ph[csx]_/.test(value ?? '')
    if (value && !excludedHeaders.includes(name) && !isNonBearerAuth) {
      headers.set(key, value)
    }
  }

  headers.set('host', hostname)

  // Forward client IP for geolocation
  const clientIp = getHeader(event, 'x-forwarded-for') || getRequestIP(event)
  if (clientIp) {
    headers.set('x-forwarded-for', clientIp)
  }

  // Read body as binary buffer to preserve gzip compression
  const body = event.method !== 'GET' && event.method !== 'HEAD'
    ? await readRawBody(event, false)
    : undefined

  const response = await fetch(targetUrl, {
    method: event.method,
    headers,
    body,
  })

  // Copy response headers, excluding problematic ones
  for (const [key, value] of response.headers.entries()) {
    if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
      setResponseHeader(event, key, value)
    }
  }

  setResponseStatus(event, response.status)

  // Return binary response
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
})
