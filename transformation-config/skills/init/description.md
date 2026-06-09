# Initialize PostHog

Set up PostHog so the SDK is configured once and available across the app.

## Environment variables

Set the PostHog keys through the wizard tools (`set_env_values`), never
hardcoded. Use the framework's public env convention so the client can read them:
`NEXT_PUBLIC_` for Next.js, `VITE_` for Vite, `PUBLIC_` for SvelteKit.

- the public project token
- the PostHog host

## Init point

Create the framework's single initialization point that runs once on the client:

- **Next.js App Router**: a client `PostHogProvider` that calls `posthog.init`
  with the env key and host, wrapping the app in the root layout.
- **Other frameworks**: the equivalent provider or bootstrap that initializes
  PostHog once.

Read the existing provider or layout before editing, and add PostHog alongside
what is already there rather than replacing it.

## Reference

{references}
