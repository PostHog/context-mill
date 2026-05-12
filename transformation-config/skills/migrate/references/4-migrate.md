---
title: Perform the migration
next_step: 5-cleanup.md
---

# Step 4 — Perform the migration

For each entry in `.posthog-migration-plan.json`, make edits to replace the source's call site with the PostHog equivalent from the migration guide. Carefully examine the migration-source skill's reference files: your replacements should match them as closely as possible. Do not spawn subagents.

Use environment variables for PostHog keys. Do not hardcode PostHog keys.

If a file already has existing integration code for other tools or services that you are **not** migrating, don't overwrite or remove that code. Replace only the calls that belong to the targets in `.selected-targets.txt`.

For each call site, use the migration-source skill's reference files as the canonical replacement. You also have access to the framework integration skill installed in Step 2 — consult its example code and documentation for framework-specific init shape (where to put the `posthog.init` call, which runtime it belongs in, the env-var name to use). Carefully consider how the user project's framework version may impact the correct PostHog integration approach.

Remember that you can find the source code for any dependency in the `node_modules` directory. This may be necessary to confirm property names or call signatures. There are also example project code files available via the framework integration skill; use these for reference.

Where possible, add calls for PostHog's `identify()` function on the client side upon events like logins and signups. Use the contents of login and signup forms to identify users on submit. If there is server-side code, pass the client-side session and distinct ID to the server-side code to identify the user. On the server side, make sure events have a matching distinct ID where relevant.

It's essential to do this in both client code and server code, so that user behavior from both domains is easy to correlate.

Do not add new captures, new feature flag evaluations, or new identification beyond what's already in the plan. The migration is a faithful port; net-new instrumentation belongs to a separate run of the wizard's basic-integration flow.

Remember: do not alter the fundamental architecture of existing files. Make your edits minimal and targeted.

Remember the migration-source guide and framework integration skill resources you were provided. Read them now if you have not already.

## Status

Status to report in this phase:

- Reading migration plan
- Inserting PostHog init code
- A status message for each file whose edits you are planning, including a high level summary of changes
- A status message for each file you have edited
- Inserting PostHog identification code
