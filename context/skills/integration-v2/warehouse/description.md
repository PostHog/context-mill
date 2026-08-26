# Connect the detected data sources

Your task input lists the data sources the wizard found in this project. Each
one carries a **kind** (the PostHog source-type name, e.g. `Postgres`,
`Stripe`), a **label**, the **signal** it was detected by, and a **mode**:

- **`in-cli`** — create the source from here (databases and API-key SaaS).
- **`deep-link`** — hand the user a pre-filled URL to finish in the PostHog app
  (OAuth sources have no safe terminal credential path).

## Reference files

{references}

Consult the source docs above for per-source field requirements and sync
behavior.

## Tools

- **`external-data-sources-wizard`** — the required fields for a source type.
  **Always call it for a kind before you create that kind**, and always pass
  `source_type` (e.g. `source_type: "Postgres"`, or `"Postgres,Stripe"`). The
  unfiltered response describes every source and runs to hundreds of KB.
- **`data-warehouse-source-setup`** — the **default** way to create a source. It
  validates the credentials, discovers the tables, applies sensible sync
  defaults, and creates the source in one call — **no `schemas` array**. Use it
  for every SaaS source (Stripe, Resend, Sentry, …): those have small fixed
  schemas, and the low-level create tool rejects them when no `schemas` array is
  supplied. For a webhook-capable source it also registers the webhook — read
  the `webhook` key in the response, and if `webhook.pending_inputs` is
  non-empty, ask for those values and submit them.
- **`external-data-sources-db-schema`** — validates credentials and lists the
  tables available to sync. Use it for a database source when the user wants
  only some of its tables, so you can build a `schemas` array.
- **`external-data-sources-create`** — the **advanced** create, for hand-picking
  tables or per-table sync types on a database source. The `schemas` array goes
  **inside** `payload`, not as a top-level argument; its input schema is the
  source of truth. Don't reach for it on a SaaS source — `data-warehouse-source-setup`
  is the one-step path there.
- **`check_env_keys`** — tells you which `.env` keys exist. It never returns
  values.
- **`wizard_ask`** — the only way to obtain a credential value from the user.
  It takes up to 8 `questions` and an optional `subject` tag. Always set
  `subject` to the source kind you are collecting for.

## Guiding tenets

1. **Never read or guess a secret.** Every credential value comes from
   `wizard_ask`. Never invent a host, password, or API key.

2. **One `wizard_ask` call per source, tagged with `subject`.** Ask for all of
   that source's fields in a single call. The schema takes up to 8 questions
   per call. Set `subject` to the source kind — for example
   `subject: "Postgres"`. The runtime counts its batching guard per subject, so
   one call per source is never interrupted, whatever the number of sources.
   Never put two different sources in one call: five sources need 15 to 25
   fields, and no single call can hold them.

   Reuse a `subject` only for the same source, such as re-asking a field after
   a validation failure. Three calls in a row on one subject earn a one-time
   nudge. That nudge is not a refusal and not a reason to stop: send the call
   again and it goes through. A cancelled or timed-out `wizard_ask` does not
   count against the per-run cap.

3. **Collect these as plain `text` answers.** Marking a field `sensitive`
   returns a `{ secretRef }` that only `set_env_values` can resolve, and the
   PostHog tools reject it. Anything you hand straight to a PostHog tool must
   be a normal answer.

4. **The MCP defines the fields, not you.** Ask for exactly what
   `external-data-sources-wizard` lists for that kind, respecting `required`.
   Add nothing, omit nothing.

5. **Respect the mode.** Collect credentials only for `in-cli` sources. For a
   `deep-link` source, give the URL and stop.

6. **Change no project code.** This step connects external data. It edits
   nothing in the app.

7. **A decline answers one source, not the run.** If the user cancels, times
   out, or says no, that source falls back to the deep-link URL. Do not re-ask
   for it. Do ask for the next source: one cancellation says nothing about the
   sources you have not reached yet. Stop asking only after two cancellations
   in a row, and give the rest their links.

8. **Report what you created, not what you attempted.** A deep link is a
   handoff, not a connected source. When you created no source, say so plainly
   in your report section and in your task status. The wording for each case is
   in **Your report section** and **Task status** below.

## Pre-flight: the gotchas that cause most failures

Raise these **before** you collect credentials — they are the top reasons a
first attempt fails, and a failed attempt wastes the user's time.

- **The host must be reachable from PostHog's network.** `localhost`,
  `127.0.0.1`, and private hosts (`10.x`, `192.168.x`, `172.16–31.x`) are
  rejected: PostHog connects from its own infrastructure, not this machine.
  Managed Postgres (Neon, Supabase, RDS behind strict rules) often needs
  PostHog's egress IPs allowlisted first. If the database is not publicly
  reachable, go straight to the deep-link path.
- **Supabase is Postgres — set it up as one source.** Use the **Session
  pooler**, not the direct host, which is IPv6-only. The pooler host looks like
  `aws-0-<region>.pooler.supabase.com`, the **username** is
  `postgres.<project-ref>`, and the **port is 6543**. The password is the
  database password from Settings → Database, which is neither the `anon` or
  `service_role` key nor the account password. When `SUPABASE_URL` exists in
  the env, read the project ref from `db.<ref>.supabase.co` and pre-fill the
  host and username in your question.
- **Scope a database source to one schema, and never sync auth tables.** Set the
  `schema` field (default `public`) so discovery and sync cover only that schema.
  A managed database exposes internal schemas alongside your data — Supabase adds
  `auth`, `storage`, and more — so an unscoped discovery both returns hundreds of
  tables (the response truncates before you can review them) and walks the
  customer's auth schema. Keep discovery on the user's own schema, and never
  select an `auth` or other internal-schema table into the `schemas` array.
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
them. For each one: read its field list, ask for its fields in a single
`wizard_ask` call tagged with its kind, then create it. Finish a source before
you start the next one, so a later cancellation cannot lose an earlier source.

A run often carries 5 to 8 `in-cli` sources. That is normal, and the
per-subject guard is built for it. Never drop a source because you think you
have asked too many questions.

### An `in-cli` source

1. `[STATUS] Configuring <label>`
2. Call `external-data-sources-wizard` with `source_type` set to this kind and
   read the field list. Check the pre-flight gotchas for the kind.
3. Optionally call `check_env_keys` to see which matching keys exist, and use
   that to word your question — "we noticed `DATABASE_URL` is set, please paste
   the connection details". You still cannot read the value.
4. Ask for this source's required fields in ONE `wizard_ask` call, with
   `subject` set to this kind. On a decline, give this source the deep-link
   path, then continue with the next source.
5. Create the source, choosing the tool by kind:
   - **A SaaS source** (an API key or token — Stripe, Resend, Sentry, …): call
     `data-warehouse-source-setup` with `source_type` = the kind and the
     credential `payload`. It discovers the tables and applies sync defaults —
     pass no `schemas`. Check the `webhook` key on the response for a
     webhook-capable source.
   - **A database source** (Postgres, MySQL, …): first call
     `external-data-sources-db-schema` to validate the credentials and list
     tables. On a validation failure, report the error and let the user correct
     it once, or fall back to deep-link. Then create with
     `external-data-sources-create`, putting the credential fields, a `schemas`
     array selecting the tables to sync (`incremental` with the detected
     incremental field where one exists, otherwise `full_refresh`), and
     `access_method` = `warehouse` together in `payload`.
6. On success: `[STATUS] Connected <label>`. On failure, record the error
   against that source and move on to the next one — one source that will not
   connect is not a reason to abandon the rest.

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

- **connected** — name the tables that sync and how.
- **needs the browser** — give the full URL.
- **skipped** — say why, in one line.

Claim nothing you did not observe. A source is connected when the create tool
(`data-warehouse-source-setup` or `external-data-sources-create`) returned
success, not when the credentials looked right. A deep link is a handoff, not a
connection.

When you connected no source, say so in that first line and give the reason.
For example: `Connected 0 of 5 detected sources. The user cancelled the
credential prompts, so all 5 need browser setup.` Do not call the step
complete, successful, or set up.

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
