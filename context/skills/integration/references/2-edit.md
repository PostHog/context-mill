---
next_step: 3-revise.md
title: PostHog Setup - Edit
description: Implement PostHog event tracking in the identified files, following best practices and the example project
---

For each of the files and events noted in .posthog-events.json, make edits to capture events using PostHog. Make sure to set up any helper files needed. Carefully examine the included example project code: your implementation should match it as closely as possible. Do not spawn subagents.

Use environment variables for PostHog keys. Do not hardcode PostHog keys.

If a file already has existing integration code for other tools or services, don't overwrite or remove that code. Place PostHog code below it.

For each event, add useful properties, and use your access to the PostHog source code to ensure correctness. You also have access to documentation about creating new events with PostHog. Consider this documentation carefully and follow it closely before adding events. Your integration should be based on documented best practices. Carefully consider how the user project's framework version may impact the correct PostHog integration approach.

Remember that you can find the source code for any dependency in the node_modules directory. This may be necessary to properly populate property names. There are also example project code files available via the PostHog MCP; use these for reference.

Where possible, add calls for PostHog's identify() function on the client side upon events like logins and signups. Use the contents of login and signup forms to identify users on submit. If there is server-side code, pass the client-side session and distinct ID to the server-side code to identify the user. On the server side, make sure events have a matching distinct ID where relevant. 

It's essential to do this in both client code and server code, so that user behavior from both domains is easy to correlate.

You should also add PostHog exception capture error tracking to these files where relevant.

## AI Observability and Logs

Include both in a default integration where applicable, after the SDK and event
instrumentation above and before the revise and conclusion steps. Run AIO first,
then Logs, so edits to manifests and initialization files do not conflict.

1. **AI Observability:** inspect existing LLM call sites. If there are none, skip
   AIO and record that reason; do not add a vendor SDK or artificial model calls.
   Otherwise call `load_skill_menu` with `category: "ai-observability"`, install
   the matching variant with `install_skill`, and follow its references. Choose
   the provider/framework and language from the actual calling code. Use manual
   capture only for existing calls without a supported wrapper. Reuse the client
   and identity already established. Enable privacy mode by default so prompt and
   completion content stays out of PostHog until the user opts in: set the
   privacy-mode option on the client the instrumentation uses, or the variant's
   documented handler/per-request option where capture is configured there; for
   manual capture, omit `$ai_input` and `$ai_output_choices`. Metadata (model,
   tokens, latency, cost) still flows. If the provider remains ambiguous, skip
   with that reason instead of asking a question during the default run.
2. **Logs:** call `load_skill_menu` with `category: "logs"`, install the matching
   skill, and follow the documented setup for this runtime. Use SDK-native log
   capture where documented, otherwise the platform's OTLP exporter. Do not add a
   server exporter to browser-only code. If no documented setup applies, skip with
   the reason. Export only log lines this integration adds: wire the exporter to
   a dedicated logger and emit a few purpose-written lines at meaningful points
   the app already passes through — never attach it to the application's root or
   existing loggers, even where the platform docs show that; the app's existing
   logs are not this run's to export. Preserve existing handlers, outputs, and
   any AIO tracing provider; an existing PostHog exporter needs no duplicate. Do
   not add logs to unrelated code.

For both skills, use the project credentials and region supplied by the wizard.
Inspect and change environment files only through `check_env_keys` and
`set_env_values`, reusing existing variable names. Do not ask for credentials or
guess a region. Follow this runtime's tool restrictions; defer any dependency
installation or verification still needed to the revise step, recording the
package names — never write a version number you invented into a manifest; the
package manager resolves real versions at install. Write against the versions
of packages the app already has: never upgrade, or write code that assumes
upgrading, a dependency this integration did not introduce. Do not make paid
LLM calls or claim delivery based on code changes. Keep each result (configured,
already present, or skipped with a reason) for the final report, including a
concrete path the user can trigger to check delivery.

Remember: Do not alter the fundamental architecture of existing files. Make your additions minimal and targeted.

Remember the documentation and example project resources you were provided at the beginning. Read them now.

## Status

Status to report in this phase:

- Inserting PostHog capture code
- A status message for each file whose edits you are planning, including a high level summary of changes
- A status message for each file you have edited
