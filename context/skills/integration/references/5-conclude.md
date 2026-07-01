---
next_step: null
title: PostHog Setup - Conclusion
description: Locate the dashboard and insights created earlier, surface the link, and write the setup report
---

The dashboard "Analytics basics (wizard)" and its insights were already created earlier, before any code was written. Do not create a new dashboard here. Instead, use the PostHog MCP to **locate** it — by the dashboard id you noted in the dashboard phase, falling back to searching for a dashboard named "Analytics basics (wizard)" (the `(wizard)` tag with that exact casing is how wizard-created artifacts are found). Retrieve the dashboard's URL and the URLs of its insights, and confirm they still exist.

If the revise phase reconciled any deviation (an insight added, removed, or renamed to match the final code), confirm those changes are reflected on the dashboard before continuing.

Emit the dashboard's URL on its own line in your assistant message using this exact marker: `[DASHBOARD_URL] <full https url>`. The wizard parses this marker from your visible message and surfaces the link in the success summary. Mentioning the URL only in thinking or in prose without the marker means the link is dropped.

Search for a file called `.posthog-events.json` and read it for available events.

Do not spawn subagents.

Create the file posthog-setup-report.md. It should include a summary of the integration edits, a table with the event names, event descriptions, and files where events were added, a list of links for the dashboard and insights created, and a "Verify before merging" checklist (see below). Follow this format:

<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. [Detailed summary of changes]

[table of events/descriptions/files]

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

[links]

## Verify before merging

[checklist]

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>

For the "Verify before merging" checklist, write GitHub-style checkboxes (`- [ ] ...`) covering what the developer (or their coding agent) still needs to do to take this from "wizard finished" to "merged". Include ONLY the items that actually apply to the integration you just performed — judge each against the code you changed in this run, and drop any that don't fit. Phrase each item as a concrete, checkable action. Candidate items, with the condition for including each:

- Always: "Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code."
- Always: "Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures."
- If you added environment variables: "Add the exact PostHog env var names you added to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set."
- If this integration ships a minified production browser bundle (most SPA/SSR web frameworks — e.g. Next.js, Nuxt, SvelteKit, Astro, Vite-based apps): "Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify."
- If LLM analytics was set up in this run: "Trigger the LLM call path(s) you instrumented and confirm `$ai_generation` events appear in PostHog AI Observability."
- If the app has user auth and an `identify` call was added: "Confirm the returning-visitor path also calls `identify` — a handler that only identifies on fresh login can leave returning sessions on anonymous distinct IDs."

Do not invent items beyond what applies. If only the two "Always" items apply, the checklist is just those two.

Upon completion, remove .posthog-events.json.

## Status

Status to report in this phase:

- Linked dashboard: [insert PostHog dashboard URL]
- Created setup report: [insert full local file path]
