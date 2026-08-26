# PostHog Data Warehouse — Source Setup

This skill connects a data source the project already uses (a database like Postgres/MySQL, or an API-key source like Stripe) to PostHog's data warehouse, so the data can be queried alongside product analytics.

The wizard has already scanned the project and lists the detected sources in your prompt. Each detected source has a **kind** (e.g. `Postgres`, `Stripe` — this is the PostHog source-type name), a **label**, and a **mode**:

- **`in-cli`** — create the source directly from here (databases and API-key SaaS).
- **`deep-link`** — give the user a pre-filled URL to finish in the PostHog app (OAuth sources; no safe terminal credential path).

## Reference files

{references}

Consult the PostHog data warehouse source docs above for source-specific field requirements and sync behavior.

## Tools you will use

You have the PostHog MCP server and the wizard's local tools available. The PostHog tools below are reached through its `exec` tool:

{{> mcp-tool-calling}}

- **`external-data-sources-wizard`** — returns the required fields per source type. **Always call this for a source kind before creating it** — never guess field names. **Pass `source_type` with the kind(s) you need** (e.g. `source_type: "Postgres"`, or comma-separated `"Postgres,Stripe"`). The unfiltered response describes every source and is hundreds of KB — large enough to blow your context budget — so never call it without `source_type`.
- **`external-data-sources-db-schema`** — validates credentials and lists the tables available for sync. Use this for database sources before creating.
- **`external-data-sources-create`** — creates the source. Follow its input schema exactly for the `payload` and `schemas` shape; the tool definition is the source of truth.
- **`mcp__wizard-tools__check_env_keys`** — tells you which `.env` keys EXIST. It never returns values.
- **`mcp__wizard-tools__wizard_ask`** — the ONLY way to obtain credential values from the user. It takes up to 8 `questions` and an optional `subject` tag. Always set `subject` to the source kind you are collecting for.

## Guiding tenets

1. **Never read or guess secret values.** You cannot read `.env` values — `mcp__wizard-tools__check_env_keys` only reveals which keys exist. Obtain every credential value from the user via `mcp__wizard-tools__wizard_ask`. Never fabricate a host, password, or API key.

2. **One `mcp__wizard-tools__wizard_ask` call per source, tagged with `subject`.** Ask for all of that source's fields (host, port, database, user, password, schema, …) in a single call. The schema accepts up to 8 questions per call. Set `subject` to the source kind — for example `subject: "Postgres"`. The runtime counts its batching guard per subject. One call per source is therefore never interrupted, whatever the number of sources. Never put two different sources in one call. Reuse a `subject` only for the same source, for example when you re-ask a field after a validation failure. Three calls in a row on one subject earn a one-time nudge. That nudge is not a refusal and not a reason to stop: send the call again and it goes through. A cancelled or timed-out `wizard_ask` does **not** count against the per-run cap. Treat a cancelled ask as "the user declined" for that source, and see the tenet below.

3. **Don't pass secret references to the PostHog tools.** If you mark a `wizard_ask` field `sensitive`, the answer comes back as `{ secretRef: ... }`, which only `mcp__wizard-tools__set_env_values` can resolve — `external-data-sources-db-schema`/`-create` reject it. For credentials you'll hand straight to those tools, collect them as normal (non-`sensitive`) `text` answers so you get the real value; reserve `sensitive` for secrets you're only writing to `.env`.

4. **The MCP defines the fields, not you.** Call `external-data-sources-wizard` (with `source_type`) for the kind and ask for exactly the fields it lists (respecting `required`). Don't invent extra fields or omit required ones.

5. **Respect the mode.** Only collect credentials and create `in-cli` sources. For `deep-link` sources, provide the URL and stop — do not try to collect OAuth tokens.

6. **Report what you created, not what you attempted.** A browser deep link is a handoff, not a connected source. If you created no source in PostHog, say so plainly in your report and in your task status. Never report a run as done when `external-data-sources-create` never succeeded. The exact wording for each case is in **Report** and **Task status** below.

7. **Don't modify project code.** This skill connects external data; it does not edit the user's application. Make no source-code changes.

## Pre-flight: credential gotchas that cause most failures

Surface these **before** collecting credentials — they're the top reasons setup fails on the first try, and a failed attempt wastes a `wizard_ask`.

- **The host must be reachable from PostHog's network.** `localhost`, `127.0.0.1`, and private/RFC-1918 hosts (`10.x`, `192.168.x`, `172.16–31.x`) are rejected — PostHog connects from its own infrastructure, not the user's machine. Serverless/managed Postgres (Neon, Supabase, RDS behind strict rules) often also needs PostHog's egress IPs allowlisted first. If the database isn't publicly reachable, go straight to the deep-link path instead of collecting credentials that can't validate.
- **Supabase is Postgres — set it up as one source.** Use the **Session pooler**, not the direct host (the direct host is IPv6-only). The pooler host looks like `aws-0-<region>.pooler.supabase.com`, the **username** must be `postgres.<project-ref>`, and the **port is 6543** (not 5432). The password is the **database** password (Supabase → Settings → Database), which is distinct from the `anon`/`service_role` JWT keys and the account password. If `SUPABASE_URL` exists in the env, derive the project ref from `db.<ref>.supabase.co` to pre-fill the host/username in your prompt.
- **Many SaaS sources need a specific key type or plan** — name the right one in your `wizard_ask` prompt so the user doesn't paste the wrong thing: **Stripe** wants a _restricted_ key (`rk_live_…`), not `sk_live_…`; **Sentry** wants an internal-integration token (not a DSN or personal token); **RevenueCat** a v2 secret key with read scopes; **Convex** requires the Professional plan; **Twilio** an API Key SID + Secret (not the account auth token); **Mailchimp** a key with its `-usX` datacenter suffix. For send-only services (Resend, Mailgun) the key in the env is often restricted — the warehouse import needs a full/read-access key.

## Many `in-cli` sources: work through them one at a time

A run often detects 5 to 8 `in-cli` sources. Postgres alone needs 5 fields, so their fields never fit in one 8-question prompt. This is normal. Do this:

- Process the sources one at a time, in the order your prompt lists them.
- Send one `wizard_ask` call for each source, with `subject` set to that source's kind.
- Create the source before you move to the next one, so a later cancellation cannot lose an earlier source.
- If a kind needs more than 8 fields, send two calls with the **same** `subject`. Ask for the required fields first.
- Never skip a source because you think you have asked too many questions. The per-subject guard exists for this shape of work.

If the user cancels one source's prompt, keep going. A cancellation applies to that source only. Give that source the deep link, then ask for the next source. Do not stop the run, and do not convert the remaining sources to deep links because of one cancellation.

If the user cancels **two prompts in a row**, stop asking. Give the remaining sources their deep links, and report the run as described in **Task status** below.

## Workflow

If your prompt lists no detected sources, emit `[ABORT] No data source detected` and stop. The wizard middleware catches `[ABORT]` and terminates the run.

Process each detected source in turn.

### For an `in-cli` source

1. `[STATUS] Configuring <label>`
2. Call `external-data-sources-wizard` **with `source_type` set to this `kind`** (never unfiltered) and read the field list. Check the pre-flight gotchas above for this kind before prompting.
3. Optionally call `mcp__wizard-tools__check_env_keys` to see which matching keys already exist — use this only to tailor your prompt (e.g. "we noticed `DATABASE_URL` is set; please paste the connection details"). You still cannot read the value.
4. Call `mcp__wizard-tools__wizard_ask` ONCE for this source. Request every required field in that one call, and set `subject` to this `kind`. If the user declines or cannot supply the fields, give this source the deep-link path below, then continue with the next source.
5. For database sources, call `external-data-sources-db-schema` with the credentials to validate them and list tables. If validation fails, report the error and let the user correct it. Use one more `mcp__wizard-tools__wizard_ask` with the **same** `subject`, or fall back to deep-link.
6. Build the create payload: `source_type` = the kind, the credential `payload`, `access_method` = `warehouse` (use `direct` only if the user explicitly wants live querying without import), and a `schemas` array selecting tables to sync (default: sync the tables the user wants; pick `incremental` sync with the detected incremental field when available, otherwise `full_refresh`). Follow the `external-data-sources-create` input schema for the exact shape.
7. Call `external-data-sources-create`. On success: `[STATUS] Connected <label>`. On failure, report the error, give this source the deep-link path, and continue with the next source. Emit `[ABORT] Source creation failed` only when creation failed for every `in-cli` source and you created none.

### For a `deep-link` source

1. `[STATUS] <label> needs browser setup`
2. Build the URL from the project context in your prompt (PostHog Host + Project ID):
   `<host>/project/<projectId>/data-warehouse/new-source?kind=<kind>&utm_source=wizard&utm_campaign=warehouse-source`
   Keep the `utm_*` params exactly as written — they let PostHog attribute sources finished in the browser back to the wizard handoff.
3. Tell the user to open that URL to finish connecting `<label>` (OAuth happens in the app). Include the URL in your report. Do not attempt credential collection.

### Non-interactive / CI

If `mcp__wizard-tools__wizard_ask` is unavailable or blocked (CI / headless), do NOT block. Treat every source as deep-link: emit the new-source URL for each and note that credentials must be entered in the app. You created no source, so report the run as `not needed`.

## Report

After processing all sources, write the report file requested by the wizard.

Start the report with one line that counts what you created:

- `Created N of M detected sources in PostHog.`

Count a source as created only when `external-data-sources-create` returned success. A deep link is a handoff, not a created source. Then summarize:

- Which sources were created in PostHog (kind + which tables sync).
- Which sources need browser setup, with their URLs.
- Any source that was skipped, and why.

When you created no source, say so in the first line and give the reason. For example: `Created 0 of 5 detected sources in PostHog. The user cancelled the credential prompts, so all 5 need browser setup.` Do not describe the run as complete, successful, or set up.

## Status

Report progress with `[STATUS]` prefixed messages (e.g. `Configuring Postgres`, `Connected Postgres`, `Stripe needs browser setup`).

Emit a final `[STATUS]` line that carries the same count as the report, e.g. `[STATUS] Created 2 of 5 sources; 3 need browser setup`.

## Task status

When the wizard gives you a `complete_task` tool, pick the status from what you created. Use only the values it accepts:

- **`done`** — you created at least one source in PostHog. Name the created sources in the handoff. Also name any source you handed to the browser.
- **`not needed`** — you created no source, and a retry cannot change that. Use this when the user cancelled or declined the prompts, when the hosts are unreachable from PostHog's network, or when every detected source is `deep-link`. Say which reason applies in the handoff, and list every browser URL you gave. Do **not** use `done`.
- **`failed`** — you created no source because every creation attempt returned a tool error. Put the errors in the handoff. The wizard may retry the task, so use this only for an error a retry could clear — never for a user who declined.

Without a `complete_task` tool, the report's first line carries this outcome instead.

## Abort statuses

Report abort states with `[ABORT]` prefixed messages:

- No data source detected
- Source creation failed

## Framework guidelines

{commandments}
