---
type: init
flow: error-tracking
label: Set up PostHog initialization
model_pi: openai/gpt-5.6-sol
effort_pi: low
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: [integration-v2-init, posthog-best-practices]
allowedTools: [Read, Write, Edit, Glob, Grep, Bash]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Make sure PostHog is initialized. If the project already has a working
`posthog.init(...)` (or the framework's equivalent) with its env keys wired,
leave it alone and say so in your handoff. If it doesn't, create it following
your skill — it owns the how: the framework's init point, the env-var wiring
through the wizard tools, and `.env.example`.

You only exist in this flow because the user asked for error tracking on a
repo without PostHog. Initialize the SDK so exceptions can flow and stop —
no instrumentation, no extras. Don't set up exception capture either way;
the capture-exceptions task after you owns that.

## Make the environment actually reachable

Writing the keys to `.env` is only half the job — something has to load that
file at runtime, or the app throws on boot and captures nothing.

Most frameworks do it for you: Next, Nuxt, Astro and SvelteKit auto-load `.env`,
and Vite auto-loads it for client code. Nothing to do there.

A plain Node backend does not — Express, Fastify, Hono, Koa, a raw `node:http`
server — and neither does a bare Rollup or webpack config. When your init point
reads `process.env` on one of those, wire the loading too, either way:

- install `dotenv` with the project's own package manager (detect it from the
  lockfile) and import it above the PostHog init — `require('dotenv').config()`,
  or `import 'dotenv/config'` for ESM; or
- add `--env-file=.env` to the `start` and `dev` scripts, when the project is on
  Node 20.6+ and would rather not take a new dependency.

Then start the app once and confirm it boots. An app that exits at module load
with `POSTHOG_… variable required by PostHog is missing or un-configured` is a
failed init, not a finished one — that message is the guard you wrote firing
against an env file nothing reads.

Some platforms have no environment to read at all, and there the answer is not
a loader. Angular on the stock `@angular/build` builder is the common one:
nothing defines `process.env` or `import.meta.env` in the browser bundle, so a
config reading either one throws while the module evaluates and the app renders
a blank page. Never invent the mechanism — `import.meta.env` and the `NG_APP_`
prefix come from `@ngx-env/builder`, so use them only when that dependency is
already in `package.json`. When the project has no such mechanism, put the real
public project token straight into the committed `src/environments/*` files;
this is the skill's "no valid environment to read from" case, and the public
token is publishable — it ships inside the browser bundle either way.

## How you know you succeeded

An init point exists with the PostHog env keys present — whether it already
did or you just created it — keys in the env file, never hardcoded. On a
platform that does not auto-load `.env`, the loading is wired and the app
starts cleanly. Your handoff names the files involved, how the client is
constructed, and how `.env` reaches it, so the capture-exceptions task can find
the init options without re-discovering them.
