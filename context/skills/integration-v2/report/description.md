# Write the setup report

Write `posthog-setup-report.md` at the project root. When the file doesn't exist, write
it directly — don't attempt a read first. If a previous run left one behind, `Read` it,
then replace it wholesale (harnesses refuse to overwrite a file that wasn't read;
nothing in the old report is worth merging).

One source: the run's queue log, `.posthog-wizard-cache/queue.json`, which holds every
task's handoff inline. It tells you what each step did, whether identify was wired or
skipped, which products were enabled or refused, and any build conflict — and it carries
the `product-signals` handoff, whose `forNextAgent` block is one line per product in the
shape `<product>: yes|no|partial — <reason> (<files>)`. That block is what the suggestion
sections are built from.

This run captured no events, created no insights, and built no dashboard. Do not write a
table of instrumented events, and do not link a dashboard — there isn't one.

## Sections, in this order

1. **What's set up.** One line, then a table of reality only: the SDK and its version,
   the init point (file), identify (file, or skipped and why), error tracking (mechanism
   and file), the products enabled in the project with their per-product result, and LLM
   instrumentation if that step ran.
2. **What we left for your agent.** State plainly that no events, funnels, insights, or
   dashboards were created, and why: those choices belong to whoever knows the product,
   and the agent working in this repo is better placed to make them than a setup run is.
3. **Suggested events.** A table of event name, what it would measure, and the file to
   instrument it in. Draw them from the `product-analytics` signal line and the routes
   and entry points it names. Names and locations only — no code.
4. **What those events unlock.** The insights, funnels, and retention questions those
   events make answerable, each naming the events it needs. Keep to analyses the
   suggested events actually support.
5. **Driving PostHog from your agent.** How to reach the PostHog MCP, the tools that
   matter for this work (`insight-create`, `dashboard-create`, `query-run`), and the
   PostHog skills already on disk in this repo, by path.
6. **Prompts to paste into your agent.** Literal blockquoted prompts, one per follow-up:
   instrument the suggested events; build a dashboard from them; connect a data source;
   wire source-map upload if the app ships minified bundles. Each names the skill it
   leans on and the files it should start from.
7. **Suggested data sources.** From the `data-sources` and `revenue` signal lines: what
   was found, and how to connect each one.
8. **Before you merge.** GitHub-style checkboxes (`- [ ] …`), only the items that apply to
   what was set up — judge each against the code changed this run and drop the rest:
   - Always: run a full production build (the run only verified the files it touched) and
     fix any lint or type errors the generated code introduced.
   - Always: run the test suite — new init and instrumentation may need updated mocks or
     fixtures.
   - If env vars were added: their exact names are in `.env.example` and any
     monorepo/bootstrap scripts, and set in the deploy environments, not just locally.
   - If the app ships minified browser bundles: wire source-map upload into CI so
     production stack traces de-minify — call it out with the docs link.
   - If the app ships a Content-Security-Policy: load the app and check the console for
     CSP violations — a blocked SDK queues events silently and never sends.
   - If LLM analytics was set up: trigger the instrumented call path and confirm
     `$ai_generation` events appear in PostHog.
   - If auth exists and identify was wired: the returning-visitor path also calls
     identify, so returning sessions don't fragment onto anonymous distinct IDs.
9. **What we didn't do, and why.** Every task that ended `not needed` or `failed`, with
   its reason, any `conflict` line in full, and every follow-up a handoff raised — a
   product that needs project admin, a platform where replay needs its own SDK setup, a
   Support inbox with no channel connected yet. Never silent.

Sections 3, 4, and 7 exist only because the groom ran. If there is no `product-signals`
handoff in the queue log, keep the headings and say the groom didn't complete, so the
absence is visible rather than papered over. The same rule holds for any step whose
handoff is missing — name the step and say its outcome is unknown rather than omitting
it or assuming it worked.

Keep it skimmable. This is the artifact the user opens, and the brief their agent reads.
