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

// Signed-in users keep the app's own user id in a cookie. Signed-out visitors
// get a random id kept in a cookie for the visit, so they never share an id.
function getVisitor(request: Request): Visitor {
  const userId = readCookie(request, 'user_id')
  if (userId) return { id: decodeURIComponent(userId), anonymous: false }

  const anonId = readCookie(request, 'anon_id')
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
    const visitor = getVisitor(request)
    const url = new URL(request.url)

    // Anonymous events set $process_person_profile to false so PostHog does
    // not create a person profile for the visitor.
    const anonymousProps = visitor.anonymous ? { $process_person_profile: false } : {}

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
      track(posthog?.captureExceptionImmediate(error, visitor.id, anonymousProps))
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
        const userId = String(form.get('user_id') || 'burrito-fan-42')
        const email = String(form.get('email') || '')

        // Identify once, on login. The server-side equivalent of identify() is
        // an event that carries person properties in $set.
        track(
          posthog?.captureImmediate({
            distinctId: userId,
            event: 'user_logged_in',
            properties: { login_method: 'email', $set: { email } },
          })
        )

        return new Response(null, {
          status: 303,
          headers: { location: '/', 'set-cookie': `user_id=${encodeURIComponent(userId)}; ${COOKIE_OPTIONS}` },
        })
      }

      if (request.method === 'POST' && url.pathname === '/logout') {
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
            properties: { total_considerations: count, ...anonymousProps },
          })
        )

        return page(
          'Burrito considered',
          `<p>You have considered a burrito <strong>${count}</strong> time(s).</p><p><a href="/">Back home</a></p>`,
          [`burrito_count=${count}; ${COOKIE_OPTIONS}`]
        )
      }

      if (url.pathname === '/dashboard') {
        // Awaiting the flag blocks the response, which is what we want here.
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
        // A handled failure that is still worth reporting.
        try {
          throw new Error('Profile data is unavailable')
        } catch (error) {
          track(posthog?.captureExceptionImmediate(error, visitor.id, anonymousProps))
        }

        return page('Profile', '<p>Profile data is unavailable. The error was reported.</p>')
      }

      if (url.pathname === '/') {
        const status = visitor.anonymous
          ? 'Not signed in, anonymous visitor'
          : `Signed in as <strong>${escapeHtml(visitor.id)}</strong>`
        const form = visitor.anonymous
          ? `<form method="POST" action="/login">
               <label>User id <input name="user_id" value="burrito-fan-42"></label>
               <label>Email <input name="email" value="fan@example.com"></label>
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
