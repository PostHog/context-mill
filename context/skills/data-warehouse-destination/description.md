# PostHog data warehouse destination setup

This skill sends the project's PostHog events to a data warehouse that the user already runs. It creates a batch export. PostHog then writes new events to the warehouse on a schedule.

Your prompt gives you:

- The chosen warehouse type. It is one of `BigQuery`, `Snowflake`, `Redshift`, `Databricks`, `Postgres`, `S3` or `AzureBlob`. When the prompt names no type, the wizard found no warehouse and the user did not pick one.
- The warehouses that the wizard detected in the project, with the signal that matched each one.
- Sometimes, a list of data that the project could import into PostHog. Use this list only for the optional step "Route warehouse source rows".
- The PostHog project context and the name of the report file.

## Reference files

{references}

Read the batch export docs above for the permissions and the table layout of each warehouse.

## Tools you will use

You have the PostHog MCP server and the wizard's local tools. You reach the PostHog tools below through its `exec` tool:

{{> mcp-tool-calling}}

- **`external-data-destinations-connect-link`** returns a `connect_url`, a `connect_token` and `instructions`. At the `connect_url`, the user saves the warehouse credentials in PostHog. Pass `destination_type`. For `S3`, also pass `integration_kind`: `aws-s3` for Amazon S3, or `s3-compatible` for MinIO, Wasabi, Cloudflare R2, Google Cloud Storage and similar services.
- **`external-data-destinations-connect-link-status`** tells you if the user saved the connection. Pass the `connect_token`. It returns `status`, which is `pending`, `connected` or `expired`. When the status is `connected`, it also returns `integration_id` and `display_name`. It never returns credentials.
- **`batch-exports-list`** lists the batch exports of the project.
- **`batch-export-create`** creates the batch export. Its input schema is the source of truth for the `destination` object. Run `info` on it, then drill into `destination` with `schema`, before you call it.
- **`batch-export-get`** reads one batch export back.
- **`external-data-sources-list`**, **`external-data-destinations-create`** and **`external-data-destinations-add-sources`** are for the optional step "Route warehouse source rows" only.
- **`mcp__wizard-tools__wizard_ask`** is the only way to ask the user a question and wait for the answer. Set `subject` on every call.

## Guiding tenets

1. **No secret passes through you.** The user enters every credential on the connect page in the browser. Never ask for a password, an access key, a token, a service account file or a connection string. Never ask the user for an integration id. Read it from `external-data-destinations-connect-link-status`.
2. **Keep the connect token out of the report.** Pass the `connect_token` only to `external-data-destinations-connect-link-status`. Do not write the token or the `connect_url` into the report.
3. **Ask only for settings that are not secret**, such as the dataset, the database, the schema, the bucket or the table. Ask for all of them in one `wizard_ask` call.
4. **The user gives the target.** Do not guess a dataset, a database, a bucket or a table. The destination type of a batch export cannot change after you create it.
5. **Report what you created, not what you attempted.** A connect link that the user did not finish is not an export.
6. **Do not change the project code.** This skill configures PostHog. It does not edit the user's application.

## Workflow

### 1. Pick the warehouse

If the prompt names a warehouse type, use it.

If the prompt names no type, make one `wizard_ask` call with `subject: "Warehouse"`. Ask one single-choice question with the seven types and the option `I don't run a warehouse`. If the user picks that option, or cancels, create nothing and report the run as `not needed`.

When the prompt lists more than one detected warehouse, set up only the chosen type. Name the others in the report.

Then emit `[STATUS] Setting up a <Type> export`.

### 2. Check for an existing export

Call `batch-exports-list`. Look for an export whose destination type matches the chosen warehouse. For `S3`, both `AwsS3` and `S3Compatible` match.

If you find one that is not paused, add a question to the call in step 3: "`<name>` already sends events to `<Type>`. Create another export?" Give the options `Create another export` and `Stop`. If the user picks `Stop`, create nothing and report the run as `not needed`.

### 3. Ask for the target settings

Make one `wizard_ask` call with `subject` set to the type. Ask for the required settings of the type:

| Type | Ask for |
|---|---|
| `BigQuery` | dataset ID |
| `Snowflake` | database, schema, compute warehouse |
| `Redshift` | database |
| `Databricks` | SQL warehouse HTTP path, catalog, schema, table name |
| `Postgres` | database |
| `S3` | Amazon S3 or an S3-compatible service, bucket name, region, key prefix |
| `AzureBlob` | container name |

Use `batch-export-create`'s schema as the final word. If it marks a field as required that this table does not list, ask for that field too. Leave optional fields out, unless the user asks for them.

In the same call, ask how often to export, with the options `Every hour (recommended)`, `Every day` and `Every 5 minutes`. These map to the `interval` values `hour`, `day` and `every 5 minutes`.

For `Redshift`, do not ask for the host or the port. The user enters them on the connect page, with a username and a password. The connect page offers only that connection mode for Redshift.

### 4. Get the connect link

Call `external-data-destinations-connect-link` with `destination_type` set to the type. For `S3`, pass `integration_kind` from the answer in step 3.

If the tool does not exist, or it returns an error that says the feature is not enabled, emit `[ABORT] Warehouse destinations not enabled` and stop. For any other error, report the error and give the task status `failed`.

### 5. Send the user to the link

Make one `wizard_ask` call with `subject: "<Type> connection"`. Ask one single-choice question. Its text gives the `connect_url` and these steps:

- Open the link in a browser that is logged in to PostHog as the same user that logged in to the wizard.
- Enter the `<Type>` credentials and save the connection.
- Give the connection the permissions that the batch export docs above list for `<Type>`.

Give the options `I saved the connection` and `Skip for now`.

If the user picks `Skip for now`, cancels or does not answer, create nothing. Report the run as `not needed`, and say that the user can run the command again.

### 6. Read the saved connection

Call `external-data-destinations-connect-link-status` with the `connect_token`.

- **`connected`**: keep the `integration_id`. Emit `[STATUS] Connected <display_name>`.
- **`pending`**: call the status tool two more times. If the status is still `pending`, the user did not save, or saved while logged in as a different PostHog user. Ask once more with the same `subject`. Say which user to log in as, and give the `connect_url` again. Then read the status once more. If it is still `pending`, emit `[ABORT] Warehouse connection not saved` and stop.
- **`expired`**: the link is more than one hour old. Go back to step 4 one time, and send the user to the new link. If the new link also expires, emit `[ABORT] Warehouse connection not saved` and stop.

### 7. Create the batch export

Call `batch-export-create` with:

- `name`: `PostHog events to <Type>`, followed by the target in brackets, for example `PostHog events to Snowflake (ANALYTICS.POSTHOG)`.
- `model`: `events`.
- `interval`: the value from step 3.
- `destination`: `type`, `integration_id` and `config`. The `type` is the warehouse type, except for `S3`: use `AwsS3` for an `aws-s3` connection and `S3Compatible` for an `s3-compatible` connection. The `config` holds the target settings from step 3. For `Redshift`, do not pass `host`, because the connection holds it.

If the call fails:

- **The error names a field that is wrong or missing**: fix the field. If the value came from the user, ask once more with the same `subject` as step 3. Then try one more time.
- **The error says that PostHog cannot connect to the warehouse, or that the connection has no permission**: emit `[ABORT] Warehouse connection test failed` and stop.
- **Any other error**: report the error and give the task status `failed`.

When the call succeeds, read the export back with `batch-export-get`. Emit `[STATUS] Created <name>`.

### 8. Route warehouse source rows (optional)

Do this step only when the prompt lists data that the project could import, and `external-data-sources-list` returns at least one source. Otherwise skip it.

Make one `wizard_ask` call with `subject: "<Type> routing"`. Ask if PostHog should also copy the rows that its warehouse sources import into `<Type>`. Give the options `No` and `Yes, copy source rows to <Type>`. If the user picks `No` or cancels, skip the rest of this step.

If the user picks yes:

1. Call `external-data-destinations-create` with `type` set to the warehouse type (`S3` for both S3 services), a name, the same `integration_id`, and the target config that this tool asks for. This config is not the batch export config, so run `info` on the tool first. Use the targets that the user already gave. If the tool needs a field that you do not have, ask once with the same `subject`.
2. If the create call fails, tell the user why and continue to the report. The batch export from step 7 still exists, so do not abort.
3. Call `external-data-destinations-add-sources` for the sources that the user wants to copy. Do every check that the tool description lists before you call it. Do not set `resync` to `true` unless the user asks for it, because a resync reads every row again and bills every destination of the source.

### When you cannot ask

If `mcp__wizard-tools__wizard_ask` is not available (CI or a headless run), you cannot send the user to the connect link. Create nothing. Report the run as `not needed`. Say that the user can run `wizard warehouse destination` in a terminal, or set up a batch export in PostHog.

## Report

Write the report file that the wizard names. Start it with one line that counts what you created:

- `Created 1 batch export to <Type>.`
- `Created no batch export.`, followed by the reason.

Then give:

- The export name, the connection `display_name`, the target, and the interval.
- That the export sends only new events, from its first run. To export older events, the user starts a backfill on the export's page in PostHog.
- That PostHog bills batch exports by the number of rows exported.
- The result of step 8, if you did it: the destination name and the sources attached.
- The other detected warehouses that you did not set up.

Never write credentials, the `connect_token` or the `connect_url` into the report.

## Status

Report progress with `[STATUS]` messages, for example `[STATUS] Setting up a Snowflake export`, `[STATUS] Connected acme.snowflakecomputing.com` and `[STATUS] Created PostHog events to Snowflake (ANALYTICS.POSTHOG)`.

## Task status

When the wizard gives you a `complete_task` tool, pick the status from what you created. Use only the values that the tool accepts:

- **`done`**: you created the batch export. Name it in the handoff.
- **`not needed`**: you created no export, and a retry cannot change that. Use this when the user skipped or cancelled, has no warehouse, or already has an export, or when you cannot ask. Say which reason applies.
- **`failed`**: you created no export, because a tool returned an error that a retry could clear. Put the error in the handoff. Never use `failed` for a user who declined.

Without a `complete_task` tool, the first line of the report gives this outcome.

## Abort statuses

Report abort states with `[ABORT]` messages. Use these exact texts, because the wizard matches them:

- Warehouse destinations not enabled
- Warehouse connection not saved
- Warehouse connection test failed

## Framework guidelines

{commandments}
