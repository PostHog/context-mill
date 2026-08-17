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
- **`external-data-sources-db-schema`** — validates credentials and lists the
  tables available to sync. Use it for database sources before creating.
- **`external-data-sources-create`** — creates the source. Its input schema is
  the source of truth for the `payload` and `schemas` shape.
- **`check_env_keys`** — tells you which `.env` keys exist. It never returns
  values.
- **`wizard_ask`** — the only way to obtain a credential value from the user.

## Guiding tenets

1. **Never read or guess a secret.** Every credential value comes from
   `wizard_ask`. Never invent a host, password, or API key.

2. **One `wizard_ask` call per source.** Ask for all of a source's fields —
   host, port, database, user, password, schema — in a single call of up to 8
   questions. A follow-up call is right only when a later question genuinely
   depends on an earlier answer, such as correcting a field after a validation
   failure.

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

Take the sources in turn.

### An `in-cli` source

1. `[STATUS] Configuring <label>`
2. Call `external-data-sources-wizard` with `source_type` set to this kind and
   read the field list. Check the pre-flight gotchas for the kind.
3. Optionally call `check_env_keys` to see which matching keys exist, and use
   that to word your question — "we noticed `DATABASE_URL` is set, please paste
   the connection details". You still cannot read the value.
4. Call `wizard_ask` once for every required field. On a decline, fall back to
   the deep-link path for this source.
5. For a database source, call `external-data-sources-db-schema` to validate
   the credentials and list tables. On a validation failure, report the error
   and let the user correct it once, or fall back to deep-link.
6. Build the create payload: `source_type` = the kind, the credential
   `payload`, `access_method` = `warehouse`, and a `schemas` array selecting
   the tables to sync — `incremental` with the detected incremental field where
   one exists, otherwise `full_refresh`.
7. Call `external-data-sources-create`. On success: `[STATUS] Connected
   <label>`. On failure, record the error against that source and move on to
   the next one — one source that will not connect is not a reason to abandon
   the rest.

### A `deep-link` source

1. `[STATUS] <label> needs browser setup`
2. Build the URL from your project context:
   `<host>/project/<projectId>/data-warehouse/new-source?kind=<kind>&utm_source=wizard&utm_campaign=warehouse-source`
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

Claim nothing you did not observe. A source is connected when
`external-data-sources-create` returned success, not when the credentials
looked right.

## Status

Report progress with `[STATUS]` messages, such as `Configuring Postgres`,
`Connected Postgres`, `Stripe needs browser setup`.
