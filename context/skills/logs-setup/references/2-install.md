---
title: Install the log export
next_step: 3-plan.md
---

# Step 2, install the log export

Add the OpenTelemetry log export and point it at PostHog. Existing logging keeps working exactly as it does now, this only adds a second destination.

The installation doc for this runtime is on disk under `references/`. It is the source of truth for package names, import paths, and the shape of the provider setup. Read it now. Do not WebFetch it.

## Status

Emit these as you work.

```
[STATUS] Resolving ingestion region
[STATUS] Adding OpenTelemetry packages
[STATUS] Wiring the log exporter
```

## Resolve the region first

The installation doc hardcodes the US ingestion host. Writing that into an EU project produces a setup that looks correct, fails silently, and is genuinely unpleasant to debug. Settle it before you write any endpoint.

Resolve in this order.

1. The PostHog host you found in Step 1. A host containing `eu.i.posthog.com` or `eu.posthog.com` means EU, `us.i.posthog.com` or `app.posthog.com` means US.
2. A `POSTHOG_HOST` or `NEXT_PUBLIC_POSTHOG_HOST` environment variable in `.env`, `.env.local`, or `.env.example`.
3. If neither is present, ask. Call `mcp__wizard-tools__wizard_ask` with a single question offering US and EU.

The log ingestion endpoint is the region's host followed by `/i/v1/logs`.

| Region | Endpoint |
|--------|----------|
| US | `https://us.i.posthog.com/i/v1/logs` |
| EU | `https://eu.i.posthog.com/i/v1/logs` |

Derive the endpoint from the same environment variable the project already uses for its PostHog host wherever you can, so the two cannot drift apart. Only fall back to a separate variable when the project has no host variable to build on.

## Credentials

The export authenticates with the project token, the `phc_` value the PostHog SDK already uses. A `phx_` personal API key is a different credential and will not work here.

Reuse the environment variable the project already reads its token from. Only add a new variable if there isn't one. Never hardcode the token, and if you add a variable, add it to `.env.example` too if the project keeps one.

## Wire the exporter

Follow the installation doc on disk. Two details in it are load bearing and easy to skim past.

**Next.js.** Create the `loggerProvider` outside `register()` and export it. Route handlers finish before the batch processor flushes, so the provider has to be reachable for a manual flush. Guard the global registration with `process.env.NEXT_RUNTIME === 'nodejs'`, the exporter does not belong on the Edge runtime. On Next.js 14 and earlier you also need `experimental.instrumentationHook` in the Next config; on 15 and later that option is deprecated and should be removed if present.

**Python.** Attach `LoggingHandler` to the root logger. That is what makes this additive: every existing `logging` call flows to PostHog without a single call site changing. The logs API is still experimental upstream, so the imports live under the private `_logs` path (`opentelemetry._logs`, `opentelemetry.sdk._logs`). Use those, `opentelemetry.logs` does not exist. Put the setup where the app already does its startup configuration, and make it run once.

## Rules

Do not remove, replace, or reconfigure the existing logger. Do not change log levels or formats. Do not touch individual log call sites, Step 5 handles records in one place.

Do not install dependencies yet. Add the package entries to the manifest and let Step 6 install once.

Do not add correlation attributes here. That is Steps 4 and 5, and doing it now means doing it twice.

## Carry the outcome forward

The plan file does not exist yet, so this step does not record its outcome on disk. Remember the region you resolved, the endpoint you wrote, the file the provider setup landed in, and whether the wiring applied cleanly. Step 3 records all of it.

Continue to `3-plan.md`.
