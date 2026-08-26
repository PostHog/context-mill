# Connect the detected data sources

Your task input lists the data sources the wizard found in this project. Each
one carries a **kind** (the PostHog source-type name, e.g. `Postgres`,
`Stripe`), a **label**, the **signal** it was detected by, and a **mode**:

- **`in-cli`** — create the source from here (databases and API-key SaaS).
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
- **`check_env_keys`** — tells you which `.env` keys exist, and in which file.
  Call it with `keys` and **no `filePath`**. It then scans every `.env` file in
  the project, including `.env.local` and nested files such as `apps/api/.env`.
  Pass `filePath` only to limit the check to one file. It answers
  `{ "status": "present" | "missing", "foundIn": [file paths] }` for each key.
  It never returns values.
- **`wizard_ask`** — the only way to obtain a credential value from the user.

## Guiding tenets

1. **Never read or guess a secret.** Every credential value comes from
   `wizard_ask`. Never invent a host, password, or API key.

2. **Batch credential questions up front; don't make one call per source.** The
   runtime nudges you once if several `wizard_ask` calls land in a row, so with
   more than a couple of sources a call-per-source pattern trips it. Gather the
   fields in as few calls as you can: each call takes up to 8 questions, so pack
   several sources into one call wherever they fit — a handful of API-key SaaS
   sources share a call easily, while a many-field database source (host, port,
   database, user, password, …) may need its own. A follow-up call is right only
   when a later question genuinely depends on an earlier answer, such as
   correcting a field after a validation failure.

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

7. **A decline is an answer.** If the user cancels, times out, or says no, that
   source falls back to the deep-link URL. Do not re-ask.

## Pre-flight: the gotchas that cause most failures

Raise these **before** you collect credentials — they are the top reasons a
first attempt fails, and a failed attempt wastes the user's time.

- **The host must be reachable from PostHog's network.** `localhost`,
  `127.0.0.1`, and private hosts (`10.x`, `192.168.x`, `172.16–31.x`) are
  rejected: PostHog connects from its own infrastructure, not this machine.
  Managed Postgres (Neon, Supabase, RDS behind strict rules) often needs
  PostHog's egress IPs allowlisted first. If the database is not publicly
  reachable, go straight to the deep-link path.
- **Supabase has its own source type — use `Supabase`, not `Postgres`.**
  PostHog lists `Supabase` as a source type of its own. Call
  `external-data-sources-wizard` with `source_type: "Supabase"` and ask for the
  fields it returns. Its `host` field carries the Session-pooler guidance in
  its own caption. Pass that caption on to the user rather than writing your
  own. The password is the database password from Settings → Database. It is
  neither the `anon` or `service_role` key nor the account password. When
  `SUPABASE_URL` exists in the env, read the project ref from
  `db.<ref>.supabase.co` and pre-fill the host and username in your question.
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

Read every source's field list first (step 2 below), then collect the `in-cli`
credentials in as few `wizard_ask` calls as possible (tenet 2) before you start
creating sources — batching up front is what keeps you clear of the runtime's
in-a-row nudge. Then take the sources in turn to create them.

### An `in-cli` source

1. `[STATUS] Configuring <label>`
2. Call `external-data-sources-wizard` with `source_type` set to this kind and
   read the field list. Check the pre-flight gotchas for the kind.
3. Optionally call `check_env_keys` with the key names and no `filePath`. It
   scans the whole project, so its answer agrees with the signal in your task
   input. Use the answer only to word your question — "we noticed
   `DATABASE_URL` is set in `apps/api/.env`, please paste the connection
   details". You still cannot read the value. A `missing` answer is not a
   reason to stop — go on to step 4 and ask the user.
4. Ask for the required fields with `wizard_ask`, batching across sources per
   tenet 2 rather than one call per source. On a decline, fall back to the
   deep-link path for this source.
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
emit the new-source URL for each and say the credentials go in the app.

## Your report section

Put a finished markdown section in your handoff's `reportSection`. The
reporting step includes it as its own section rather than rewriting it, so
write it for the user. Give it a heading, then one line per source saying which
of three ends it reached:

- **connected** — name the tables that sync and how.
- **needs the browser** — give the full URL.
- **skipped** — say why, in one line.

Claim nothing you did not observe. A source is connected when the create tool
(`data-warehouse-source-setup` or `external-data-sources-create`) returned
success, not when the credentials looked right.

## Status

Report progress with `[STATUS]` messages, such as `Configuring Postgres`,
`Connected Postgres`, `Stripe needs browser setup`.
