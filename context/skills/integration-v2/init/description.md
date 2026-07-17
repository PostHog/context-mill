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

## Reference

{references}
