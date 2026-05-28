# PostHog Data Warehouse — Source Setup

This skill connects a data source the project already uses (a database like Postgres/MySQL, or an API-key source like Stripe) to PostHog's data warehouse, so the data can be queried alongside product analytics.

The wizard has already scanned the project and lists the detected sources in your prompt. Each detected source has a **kind** (e.g. `Postgres`, `Stripe` — this is the PostHog source-type name), a **label**, and a **mode**:

- **`in-cli`** — create the source directly from here (databases and API-key SaaS).
- **`deep-link`** — give the user a pre-filled URL to finish in the PostHog app (OAuth sources; no safe terminal credential path).

## Reference files

{references}

Consult the PostHog data warehouse source docs above for source-specific field requirements and sync behavior.

## Tools you will use

You have the PostHog MCP server and the wizard's local tools available:

- **`external-data-sources-wizard`** (PostHog MCP) — returns the required fields per source type. **Always call this for a source kind before creating it** — never guess field names.
- **`external-data-sources-db-schema`** (PostHog MCP) — validates credentials and lists the tables available for sync. Use this for database sources before creating.
- **`external-data-sources-create`** (PostHog MCP) — creates the source. Run the MCP `info external-data-sources-create` step first to confirm the exact payload and `schemas` shape; it is the source of truth.
- **`check_env_keys`** (wizard tool) — tells you which `.env` keys EXIST. It never returns values.
- **`wizard_ask`** (wizard tool) — the ONLY way to obtain credential values from the user.

## Guiding tenets

1. **Never read or guess secret values.** You cannot read `.env` values — `check_env_keys` only reveals which keys exist. Obtain every credential value from the user via `wizard_ask`. Never fabricate a host, password, or API key.

2. **Batch credential questions into a single `wizard_ask` call.** Ask for all of a source's fields (host, port, database, user, password, schema, …) in one call. Repeated calls are rate-limited and will fail — one source, one prompt.

3. **The MCP defines the fields, not you.** Call `external-data-sources-wizard` for the kind and ask for exactly the fields it lists (respecting `required`). Don't invent extra fields or omit required ones.

4. **Respect the mode.** Only collect credentials and create `in-cli` sources. For `deep-link` sources, provide the URL and stop — do not try to collect OAuth tokens.

5. **Don't modify project code.** This skill connects external data; it does not edit the user's application. Make no source-code changes.

## Workflow

If your prompt lists no detected sources, emit `[ABORT] No data source detected` and stop. The wizard middleware catches `[ABORT]` and terminates the run.

Process each detected source in turn.

### For an `in-cli` source

1. `[STATUS] Configuring <label>`
2. Call `external-data-sources-wizard` and read the field list for this `kind`.
3. Optionally call `check_env_keys` to see which matching keys already exist — use this only to tailor your prompt (e.g. "we noticed `DATABASE_URL` is set; please paste the connection details"). You still cannot read the value.
4. Call `wizard_ask` ONCE, requesting all required fields for the source. If the user declines or cannot provide them, fall back to the deep-link path below for this source.
5. For database sources, call `external-data-sources-db-schema` with the credentials to validate them and list tables. If validation fails, report the error and let the user correct it (one more `wizard_ask`), or fall back to deep-link.
6. Build the create payload: `source_type` = the kind, the credential `payload`, `access_method` = `warehouse` (use `direct` only if the user explicitly wants live querying without import), and a `schemas` array selecting tables to sync (default: sync the tables the user wants; pick `incremental` sync with the detected incremental field when available, otherwise `full_refresh`). Confirm the exact shape via `info external-data-sources-create`.
7. Call `external-data-sources-create`. On success: `[STATUS] Connected <label>`. On failure: emit `[ABORT] Source creation failed`.

### For a `deep-link` source

1. `[STATUS] <label> needs browser setup`
2. Build the URL from the project context in your prompt (PostHog Host + Project ID):
   `<host>/project/<projectId>/data-warehouse/new-source?kind=<kind>`
3. Tell the user to open that URL to finish connecting `<label>` (OAuth happens in the app). Include the URL in your report. Do not attempt credential collection.

### Non-interactive / CI

If `wizard_ask` is unavailable or blocked (CI / headless), do NOT block. Treat every source as deep-link: emit the new-source URL for each and note that credentials must be entered in the app.

## Report

After processing all sources, write the report file requested by the wizard. Summarize:

- Which sources were created in PostHog (kind + which tables sync).
- Which sources need browser setup, with their URLs.
- Any source that was skipped and why.

## Status

Report progress with `[STATUS]` prefixed messages (e.g. `Configuring Postgres`, `Connected Postgres`, `Stripe needs browser setup`).

## Abort statuses

Report abort states with `[ABORT]` prefixed messages:

- No data source detected
- Source creation failed

## Framework guidelines

{commandments}
