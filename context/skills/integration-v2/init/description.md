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

Create the framework's single initialization point that runs once on the client,
following the reference example and the docs for the right pattern. Read the
existing provider or entry file before editing, and add PostHog alongside what is
already there rather than replacing it.

## Reference

{references}
