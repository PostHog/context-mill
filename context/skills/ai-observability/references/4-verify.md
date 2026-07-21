---
next_step: null
title: AI Observability Setup - Verify
description: Give the user a concrete way to trigger a generation and confirm it lands in PostHog
---

You've installed packages and wired OTel init. The last thing this skill produces is a **verification path** the user can run themselves. Don't call the LLM from here — you don't have credentials, and the user should be the one to see the trace show up in their project.

## What to tell the user

Point them at the smallest existing code path in their project that hits the vendor SDK. Pick one from what you noted in `1-begin.md`:

- If the project has a script (`scripts/`, `bin/`, a `package.json` script) that calls the LLM, name it: "Run `npm run <script>` (or `python scripts/<file>.py`) to trigger one generation."
- If the LLM is called from an API route, name the route: "Hit `POST /api/chat` with a test message to trigger one generation."
- If the LLM lives inside a test, point at that test.
- If there is no existing call path, sketch a minimal one — a five-line script that imports the client and makes one call — but do not add it to the project unless the user asks. Include it in the report as suggested code.

## What they should see

After triggering one call:

1. In PostHog, open **Product → LLM Analytics → Generations**.
2. Filter by the current day and their `service.name` (if the OTel resource was tagged).
3. A new `$ai_generation` event should appear within a few seconds. Notable properties: `$ai_provider`, `$ai_model`, `$ai_input_tokens`, `$ai_output_tokens`, `$ai_latency`.
4. If a `posthog.distinct_id` resource attribute was set, the event should be attached to that user in Persons.

If nothing shows up within a minute:

- Confirm the OTel init actually runs — a `console.log` / `print` immediately after `sdk.start()` (or `.instrument()`) proves the entry point loaded it.
- Confirm the vendor SDK was imported *after* the OTel init in the process's load order.
- Confirm `POSTHOG_API_KEY` and `POSTHOG_HOST` were set in the env the process is actually running under, not just `.env.example`.

## Do not

- Do not run the vendor SDK yourself.
- Do not embed API keys anywhere to enable a smoke test.
- Do not claim the integration works until the user has confirmed a generation shows up. Report it as "wired, unverified" if you never got confirmation — the report step will surface that.
