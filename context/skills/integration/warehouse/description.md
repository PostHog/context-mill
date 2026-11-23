# Connect the detected data sources

Your task input lists the data sources the wizard found in this project. Each
one carries a **kind** (the PostHog source-type name, e.g. `Postgres`,
`Stripe`), a **label**, the **signal** it was detected by, and a **mode**. The
`kind` is the only valid `source_type`. The `label` is display text, and it is
often not a valid source type: the kind `HuggingFace` has the label `Hugging
Face`. The steps below say `source_type` = the kind — copy that token verbatim,
and use the `label` only in text you show the user. The modes are:

- **`in-cli`** — connect the source from here. The user enters the credentials
  on a secure PostHog connect page, and you create the source.
- **`deep-link`** — hand the user a pre-filled URL to finish in the PostHog app
  (OAuth sources have no safe terminal credential path).

The signal also names the file that holds it. An example signal is: found
`OPENAI_API_KEY` in apps/api/.env.local. The wizard read that file itself.
Trust the path it gives you. Do not assume the key is in `.env`.

## Reference files

{references}

Consult the source docs above for per-source field requirements and sync
behavior.

## Tools

- **`data-warehouse-source-connect-link`** — returns a `connect_url` for a
  source type. The page renders that source's full connection form. The user
  enters the credentials there, PostHog checks them against a live connection,
  and then stores them encrypted for 24 hours. The page does not create the
  source. Always pass `source_type`.
- **`data-warehouse-stored-credentials-list`** — lists the credentials the user
  stored on the connect page, newest first. Pass `source_type`. It returns a
  `credential_id` and timestamps, never a secret.
- **`data-warehouse-source-setup`** — creates the source in one call. Pass
  `source_type` = the kind and `payload: { "credential_id": "<id>" }`. It
  resolves the stored credentials, discovers the tables, applies sensible sync
  defaults, and creates the source. Pass no `schemas` array. For a
  webhook-capable source it also registers the webhook — read the `webhook` key
  in the response, and if `webhook.pending_inputs` is non-empty, ask for those
  values and submit them.
- **`external-data-sources-wizard`** — the fields a source type needs. Call it
  only when you need a field's caption to word a pre-flight hint, and always
  pass `source_type`. The unfiltered response describes every source and runs to
  hundreds of KB.
- **`check_env_keys`** — tells you which `.env` keys exist, and in which file.
  Call it with `keys` and **no `filePath`**. It then scans every `.env` file in
  the project, including `.env.local` and nested files such as `apps/api/.env`.
  Pass `filePath` only to limit the check to one file. It answers
  `{ "status": "present" | "missing", "foundIn": [file paths] }` for each key.
  It never returns values.
- **`wizard_ask`** — the only way to talk to the user and wait for an answer.
  It takes up to 8 `questions` and an optional `subject` tag. Always set
  `subject` to the source kind the call is about.

## Guiding tenets

1. **No secret passes through you.** The user enters every credential on the
   connect page. Never ask for a credential value in `wizard_ask`, never read
   one from a file, and never put one in a tool argument. A tool argument
   carries a `credential_id`, never the secret it stands for. Never invent a
   host, password, or API key.

2. **One `wizard_ask` call per source, tagged with `subject`.** Send the user
   to that source's connect page in a single call, and wait for the answer.
   Set `subject` to the source kind — for example `subject: "Postgres"`. The
   runtime counts its batching guard per subject, so one call per source is
   never interrupted, whatever the number of sources.
   Never put two different sources in one call: each source has its own page
   and its own answer.

   Reuse a `subject` only for the same source, such as a second confirmation
   when no stored credential appears. Three calls in a row on one subject earn
   a one-time nudge. That nudge is not a refusal and not a reason to stop: send
   the call again and it goes through. A cancelled or timed-out `wizard_ask`
   does not count against the per-run cap.

3. **The connect page defines the fields, not you.** The page renders the form
   for the kind and validates what the user enters. Do not collect fields
   yourself, and do not add a field the page does not ask for.

4. **Respect the mode.** Send only `in-cli` sources to the connect page. For a
   `deep-link` source, give the URL and stop.

5. **Change no project code.** This step connects external data. It edits
   nothing in the app.

6. **A decline answers one source, not the run.** If the user cancels, times
   out, or skips a source, that source falls back to the deep-link URL. Do not
   re-ask for it. Do ask for the next source: one cancellation says nothing
   about the sources you have not reached yet.
   Stop asking only after two cancellations in a row, and give the rest their
   links.

7. **Report what you created, not what you attempted.** A deep link is a
   handoff, not a connected source. When you created no source, say so plainly
   in your report section and in your task status. The wording for each case is
   in **Your report section** and **Task status** below.

## Pre-flight: the gotchas that cause most failures

Put the hints that apply to the kind into the `wizard_ask` question, **before**
the user opens the page. They are the top reasons a first attempt fails, and a
failed attempt wastes the user's time.

- **The host must be reachable from PostHog's network.** `localhost`,
  `127.0.0.1`, and private hosts (`10.x`, `192.168.x`, `172.16–31.x`) are
  rejected: PostHog connects from its own infrastructure, not this machine.
  Managed Postgres (Neon, Supabase, RDS behind strict rules) often needs
  PostHog's egress IPs allowlisted first. If the database is not publicly
  reachable, go straight to the deep-link path.
- **Supabase has its own source type — use `Supabase`, not `Postgres`.**
  PostHog lists `Supabase` as a source type of its own, so request the connect
  link with `source_type: "Supabase"`. The page shows the Session-pooler
  guidance in the caption of its `host` field. The password is the database
  password from Settings → Database. It is neither the `anon` or `service_role`
  key nor the account password. When `SUPABASE_URL` exists in the env, read the
  project ref from `db.<ref>.supabase.co` and name the expected host and
  username in your question. They are not secrets.
- **Scope a database source to one schema, and never sync auth tables.** Tell
  the user to set the `schema` field on the page (default `public`). Setup
  discovers and syncs every table in that schema. A managed database exposes
  internal schemas alongside your data — Supabase adds `auth`, `storage`, and
  more — so the schema must be the user's own, never `auth` or another
  internal schema.
- **Many SaaS sources need a specific key type or plan.** Name the right one in
  your question so the user does not paste the wrong thing: **Stripe** wants a
  restricted key (`rk_live_…`), not `sk_live_…`; **Sentry** an
  internal-integration token, not a DSN; **RevenueCat** a v2 secret key with
  read scopes; **Convex** the Professional plan; **Twilio** an API Key SID and
  Secret, not the account auth token; **Mailchimp** a key with its `-usX`
  suffix. For send-only services such as Resend and Mailgun, the key already in
  the env is usually restricted — the import needs one with read access.

## Workflow

Take the `in-cli` sources one at a time, in the order your task input lists
them. For each one: get its connect link, send the user to it in a single
`wizard_ask` call tagged with its kind, then create it from the stored
credential. Finish a source before you start the next one, so a later
cancellation cannot lose an earlier source.

A run often carries 5 to 8 `in-cli` sources. That is normal, and the
per-subject guard is built for it. Never drop a source because you think you
have asked too many questions.

### An `in-cli` source

1. `[STATUS] Configuring <label>`
2. Call `data-warehouse-source-connect-link` with `source_type` set to this
   kind. Check the pre-flight gotchas for the kind. If the call fails, give
   this source the deep-link path and continue with the next source.
3. Optionally call `check_env_keys` with the key names and no `filePath`. It
   scans the whole project, so its answer agrees with the signal in your task
   input. Use the answer only to word your question — "we noticed
   `STRIPE_SECRET_KEY` is set in `apps/api/.env`, copy a restricted key with
   read access into the page". You still cannot read the value.
4. Make ONE `wizard_ask` call with `subject` set to this kind. Its single
   question carries the `connect_url`, the pre-flight hints for the kind, and
   two options: `I connected <label>` and `Skip <label>`. On a skip, cancel or
   timeout, give this source the deep-link path, then continue with the next
   source.
5. Call `data-warehouse-stored-credentials-list` with `source_type` set to this
   kind, and take the newest `credential_id`. If the list is empty, the user
   did not finish the page, or filled it in a browser signed in to a different
   PostHog account. Say which account to use and ask once more with the same
   `subject`. If the list is still empty, give this source the deep-link path.
6. Call `data-warehouse-source-setup` with `source_type` = the kind and
   `payload: { "credential_id": "<id>" }`. Pass no `schemas` and no other
   credential fields. Check the `webhook` key on the response for a
   webhook-capable source.
7. On success: `[STATUS] Connected <label>`. On failure, record the error
   against that source and move on to the next one — one source that will not
   connect is not a reason to abandon the rest. A stored credential is
   single-use, so a retry needs a new visit to the connect page.

### A `deep-link` source

1. `[STATUS] <label> needs browser setup`
2. Build the URL against the PostHog **app** host — the `Base URL` the PostHog
   MCP reports in its active-environment block (for example
   `https://us.posthog.com`). Do **not** use the ingestion host shown as
   `PostHog Host` in your project context (for example `https://us.i.posthog.com`):
   that serves the API, not the app UI, so a link built from it lands the user
   nowhere.

   `<app-host>/project/<projectId>/data-warehouse/new-source?kind=<kind>&utm_source=wizard&utm_campaign=warehouse-source`

   Keep the `utm_*` parameters exactly as written — they attribute a source
   finished in the browser back to this run.
3. Tell the user to open it to finish connecting `<label>`, and carry the URL
   into your report section. Collect no credentials.

### When you cannot ask

If `wizard_ask` is unavailable, do not block. Treat every source as deep-link:
emit the new-source URL for each and say the credentials go in the app. You
connected no source, so report the task as `not needed`.

## Your report section

Put a finished markdown section in your handoff's `reportSection`. The
reporting step includes it as its own section rather than rewriting it, so
write it for the user. Give it a heading, then one line that counts what you
created:

- `Connected N of M detected sources.`

Then write one line per source saying which of three ends it reached:

- **connected** — name the tables that sync and how. For a database source,
  say that every table in the chosen schema syncs, and that the user can turn
  tables off in the app.
- **needs the browser** — give the full URL.
- **skipped** — say why, in one line.

Claim nothing you did not observe. A source is connected when
`data-warehouse-source-setup` returned success, not when the user said they
finished the page. A deep link is a handoff, not a connection.

When you connected no source, say so in that first line and give the reason.
For example: `Connected 0 of 5 detected sources. The user skipped the connect
pages, so all 5 need browser setup.` Do not call the step complete, successful,
or set up.

## Task status

Pick your `complete_task` status from what you created. Use only the values the
tool accepts:

- **`done`** — you connected at least one source. Name the connected sources in
  the handoff, and name any source you handed to the browser.
- **`not needed`** — you connected no source, and a retry cannot change that.
  Use this when the user cancelled or declined, when the hosts are unreachable
  from PostHog's network, or when every detected source is `deep-link`. Say
  which reason applies, and list every browser URL you gave. Do **not** use
  `done`.
- **`failed`** — you connected no source because every create call returned a
  tool error. Put the errors in the handoff. The wizard may retry the task, so
  use this only for an error a retry could clear — never for a user who
  declined.

## Status

Report progress with `[STATUS]` messages, such as `Configuring Postgres`,
`Connected Postgres`, `Stripe needs browser setup`. End with one `[STATUS]`
line carrying the same count as your report section, such as
`Connected 2 of 5 sources; 3 need browser setup`.
