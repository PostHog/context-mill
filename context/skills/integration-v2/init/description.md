# Initialize PostHog

Set up PostHog so the SDK is configured once and available across the app.

## Environment variables

Set the PostHog keys through the wizard tools (`set_env_values`), never hardcoded.
Use the framework's public env-var convention so the client can read them.

- the public project token
- the PostHog host

Then document these keys for other developers: add them to `.env.example` (create
it if the project has none), with the real names and empty or placeholder values —
never the real secret. This file is committed, so the next developer knows which
keys to set. The example file is the only `.env*` you may write directly; the
actual `.env` still goes through `set_env_values`.

## Init point

Where initialization belongs depends on what kind of app this is. Work that out
before you write anything.

1. **Client.** One init, running once in the browser, at the app's entry or its
   provider. The library holds its own state from there, so nothing else constructs
   it — later steps reach the same instance by importing it.
2. **Fullstack or SSR.** You will initialize both a client and a server SDK. If
   there are dedicated docs or example apps for this framework, follow their
   patterns first. If not, initialize the client and the server clients separately,
   according to the relevant docs and examples.
3. **Server.** One client per process, however long that process lives. Where it is
   long-lived, build it once at startup through whatever hook the framework gives
   you, and reuse it for every request. Where the process is per-request or
   serverless, there is no startup to hook — use the framework's container or a
   module singleton, and make sure events reach PostHog before the process dies, or
   they are lost.

Follow the reference example and the docs for this framework's pattern. Read the
existing provider, entry, or startup file before editing, and add PostHog alongside
what is already there rather than replacing it.

## The products that are init options

Product analytics, web analytics, and session replay are not separate steps of this
run — they are what a correctly configured init already gives you. For a browser SDK
that means leaving the defaults alone: autocapture and pageview capture are on unless
the init switches them off, and pageleave is what turns pageviews into web-analytics
sessions. Do not pass an option to re-assert a default.

What matters is not *cancelling* them. If the project's existing init, or an example
you are adapting, carries `autocapture: false`, `capture_pageview: false`, or
`disable_session_recording: true`, that option is what decides the product is off, and
no project-side switch can overrule it. Leave a deliberate choice the project already
made in place — but name in your handoff which of these options are set and where. A
later step turns these products on in PostHog and needs to know what the client does
with them.

Server and mobile SDKs have no equivalent: none of this is an init option there, and
replay or exception capture on those platforms needs its own setup later. Say that
rather than reaching for an option that doesn't exist.

## Content Security Policy

Before wiring a browser SDK, check whether the app ships a CSP — a meta tag in
the HTML or a header the server sends. If it restricts `script-src` or
`connect-src`, a CDN-loaded snippet is dead on arrival: the browser blocks the
SDK script, the snippet's stub queues every call into an array nothing drains,
and the diff looks complete while zero events send. Either:

- **Extend the policy.** Allow the PostHog hosts in `script-src` and
  `connect-src`, per the CSP reference below.
- **Work within it.** Bundle the `posthog-js` dependency the manifest already
  declares instead of loading it from the CDN — but bundling only covers the
  entry bundle. posthog-js lazy-loads the session-replay recorder, surveys, and
  toolbar from the PostHog assets CDN at runtime, so `script-src` must allow
  the PostHog hosts even when bundled. Events still have to send: allow the
  PostHog host in `connect-src`, or route everything through a same-origin
  proxy. `connect-src` falls back to `default-src`, so a bare
  `default-src 'self'` blocks sending too.

Whenever you extend a CSP, extend every directive the SDK needs in one pass —
partial edits fail silently (events send but replay/surveys never load):

```
script-src:  https://*.posthog.com   (lazy-loaded bundles, even when self-hosting the entry)
connect-src: <the api host>          (event ingestion + feature flags)
worker-src:  blob:                   (session replay's worker)
```

Say in your handoff which you did — the review and the report need to know how
events leave the page.

## Reference

{references}
