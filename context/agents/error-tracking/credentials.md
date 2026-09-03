---
type: credentials
flow: error-tracking
label: Get and write the upload credentials
model_pi: openai/gpt-5.6-sol
effort_pi: medium
model_sdk: claude-sonnet-4-6
effort_sdk: medium
skills: []
allowedTools: [Read, Write, Edit, Glob, Grep, Bash, load_skill_menu, install_skill, wizard_ask]
disallowedTools: [enqueue_task]
dependsOn: []
---

## Goal

Put the PostHog source-map upload credentials into this project's environment.
Install the skill your task input names (`install_skill` with the `skillId`)
and follow its **"Write credentials to the env file"** step for the variable
names and the env file to pick.

The upload needs a PostHog **personal API key** at build time. Only the user can
mint one — never call the PostHog API or any tool to create it. Get it and
write it in this one task (the key never survives across tasks):

1. Ask with `wizard_ask`, exactly:
   `{ id: "api-key", prompt: "Paste your PostHog personal API key below.\n\nDon't have one yet? Create one here:\n<SETTINGS_URL>\n\nWhen creating the key, choose the 'Source map upload' preset, then come back and paste it here.", kind: "text", sensitive: true }`
   You receive `{ secretRef: "secret:..." }` — a vaulted reference, never the raw
   value. If `wizard_ask` is unavailable (non-interactive run), report this task
   with status `not needed` and say in your handoff that the user must create
   the key and set the variables themselves; do not block.
2. Pick the env file per the skill (reuse the one PostHog's SDK already writes
   its `POSTHOG_*` vars to, when there is one). Call `check_env_keys` on it
   first (it returns present/absent, never values — never read the file
   directly).
3. Call `set_env_values`, passing the secretRef as a value object, not a
   literal string — e.g.
   `values: { "POSTHOG_CLI_API_KEY": { secretRef: "<the ref>" }, "POSTHOG_CLI_PROJECT_ID": "<PROJECT_ID>", "POSTHOG_CLI_HOST": "<UI_HOST>" }`.
   The exact variable names follow the skill's per-uploader convention. The
   wizard resolves the ref locally, so you never see the key value.
4. Document the same variable names for other developers: append them to
   `.env.example` (create it if the project has none) with empty or
   placeholder values — never a real value, and never the key itself. The
   example file is committed and is the only `.env*` you may write directly;
   it is how the next developer, and the next wizard run's `check_env_keys`,
   learns the project expects these variables.

Replace `<SETTINGS_URL>`, `<PROJECT_ID>`, and `<UI_HOST>` from your project
context. Do not touch the build config — the `configure` task owns that.

## How you know you succeeded

The env file holds the upload variables (the key as a resolved secret, the
non-secret project id and host as literals), written through the wizard tools,
never hardcoded in source, and `.env.example` documents the same names with
placeholders. Your handoff names the env file and every variable name — never
a value — so the CI task carries the same names into the pipeline.
