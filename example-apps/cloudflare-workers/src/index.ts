import { createPostHogClient, type Env } from './posthog'

interface Visitor {
  id: string
  anonymous: boolean
  setCookie?: string
}

const COOKIE_OPTIONS = 'Path=/; HttpOnly; Secure; SameSite=Lax'

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get('cookie') ?? ''
  return cookies
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1]
}

// Derive a deterministic UUID for each email so the demo uses a stable primary
// key as distinctId instead of passing a raw email address.
async function userIdForEmail(email: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase()))
  )
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

// Signed-in users keep the app's stable user UUID in a cookie. Signed-out
// visitors get a per-visit cookie UUID rather than a shared anonymous string
// so unrelated visitors are never merged into one person.
function getVisitor(request: Request): Visitor {
  const userId = readCookie(request, 'user_id')?.trim()
  if (userId) return { id: decodeURIComponent(userId), anonymous: false }

  const anonId = readCookie(request, 'anon_id')?.trim()
  if (anonId) return { id: anonId, anonymous: true }

  const id = crypto.randomUUID()
  return { id, anonymous: true, setCookie: `anon_id=${id}; ${COOKIE_OPTIONS}` }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)
}

function page(title: string, body: string, setCookies: string[] = []): Response {
  const headers = new Headers({ 'content-type': 'text/html; charset=utf-8' })
  for (const cookie of setCookies) headers.append('set-cookie', cookie)
  return new Response(
    `<!doctype html><title>${title}</title><h1>${title}</h1>${body}`,
    { headers }
  )
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const posthog = createPostHogClient(env)
    // Signed-out visitors use a per-visit cookie UUID with process_person_profile
    // set to false instead of a shared literal like anonymous.
    const visitor = getVisitor(request)
    const url = new URL(request.url)

    const anonymousOptions = visitor.anonymous ? { process_person_profile: false } : {}

    // Sends started during the request. They are awaited after the response
    // is returned, then the client is shut down.
    const pending: Promise<unknown>[] = []
    const track = (send: Promise<void> | undefined) => {
      if (send) pending.push(send.catch((error) => console.warn('PostHog send failed', error)))
    }

    let response: Response
    try {
      response = await route()
    } catch (error) {
      track(
        posthog?.captureExceptionImmediate(error, {
          distinctId: visitor.id,
          options: anonymousOptions,
        })
      )
      console.error('Unhandled error', error)
      response = new Response('Internal server error', { status: 500 })
    }

    ctx.waitUntil(
      Promise.all(pending).finally(() => posthog?.shutdown().catch(() => {}))
    )

    if (visitor.setCookie && request.method === 'GET') response.headers.append('set-cookie', visitor.setCookie)
    return response

    async function route(): Promise<Response> {
      if (request.method === 'POST' && url.pathname === '/login') {
        const form = await request.formData()
        const email = String(form.get('email') ?? '').trim()

        // Require a non-empty login field instead of falling back to a shared
        // placeholder user id, and skip cookies and capture when blank.
        if (!email) {
          return new Response('Email is required', { status: 400 })
        }

        const userId = await userIdForEmail(email)

        // Identify on login with a stable UUID as distinctId and person properties
        // in $set, including email only when non-empty.
        track(
          posthog?.captureImmediate({
            distinctId: userId,
            event: 'user_logged_in',
            properties: {
              login_method: 'email',
              ...(email ? { $set: { email } } : {}),
            },
          })
        )

        return new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': `user_id=${encodeURIComponent(userId)}; ${COOKIE_OPTIONS}` },
        })
      }

      if (request.method === 'POST' && url.pathname === '/logout') {
        if (!visitor.anonymous) {
          track(
            posthog?.captureImmediate({
              distinctId: visitor.id,
              event: 'user_logged_out',
            })
          )
        }

        return new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': `user_id=; ${COOKIE_OPTIONS}; Max-Age=0` },
        })
      }

      if (url.pathname === '/burrito') {
        const count = Number(readCookie(request, 'burrito_count') ?? 0) + 1

        track(
          posthog?.captureImmediate({
            distinctId: visitor.id,
            event: 'burrito_considered',
            properties: { total_considerations: count },
            options: anonymousOptions,
          })
        )

        return page(
          'Burrito considered',
          `<p>You have considered a burrito <strong>${count}</strong> time(s).</p><p><a href="/">Back home</a></p>`,
          [`burrito_count=${count}; ${COOKIE_OPTIONS}`]
        )
      }

      if (url.pathname === '/dashboard') {
        // Awaiting the flag blocks the response, which is needed to render the page.
        // A PostHog failure falls back to the flag being off.
        let showNewFeature = false
        try {
          const flags = await posthog?.evaluateFlags(visitor.id)
          showNewFeature = flags?.isEnabled('new-dashboard-feature') ?? false
        } catch (error) {
          console.warn('Feature flag evaluation failed', error)
        }

        return page(
          'Dashboard',
          showNewFeature
            ? '<p>You are seeing the <strong>new</strong> dashboard feature.</p>'
            : '<p>You are seeing the <strong>standard</strong> dashboard.</p>'
        )
      }

      if (url.pathname === '/profile') {
        // Report a handled failure without failing the response.
        try {
          throw new Error('Profile data is unavailable')
        } catch (error) {
          track(
            posthog?.captureExceptionImmediate(error, {
              distinctId: visitor.id,
              options: anonymousOptions,
            })
          )
        }

        return page('Profile', '<p>Profile data is unavailable. The error was reported.</p>')
      }

      if (url.pathname === '/') {
        const status = visitor.anonymous
          ? 'Not signed in, anonymous visitor'
          : `Signed in as <strong>${escapeHtml(visitor.id)}</strong>`
        const form = visitor.anonymous
          ? `<form method="POST" action="/login">
               <label>Email <input name="email" type="email" placeholder="fan@example.com" required></label>
               <button>Log in</button>
             </form>`
          : '<form method="POST" action="/logout"><button>Log out</button></form>'

        return page(
          'Burrito app',
          `<p>${status}</p>${form}
           <ul>
             <li><a href="/burrito">Consider a burrito</a> (event)</li>
             <li><a href="/dashboard">Dashboard</a> (feature flag)</li>
             <li><a href="/profile">Profile</a> (error tracking)</li>
           </ul>`
        )
      }

      return new Response('Not found', { status: 404 })
    }
  },
} satisfies ExportedHandler<Env>
