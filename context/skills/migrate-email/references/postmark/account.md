# Postmark account

What the migration needs from the person's Postmark account. The agent never changes the account: it reads what the person exports or allows.

## DNS records

A domain verified at Postmark carries these records. Keep all of them until the cutover is done. Postmark shows the exact names and values on the domain's DNS Settings page.

| Record | Name | What it does |
|---|---|---|
| `TXT` (DKIM) | `<date>pm._domainkey`, such as `20240115123456pm._domainkey` | Signs Postmark's mail |
| `CNAME` (Return-Path) | `pm-bounces` by default, or the label the person chose | Points to `pm.mtasv.net`. Takes Postmark's bounces, and aligns its SPF |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- While Postmark renews a DKIM key, the domain carries a second `<date>pm._domainkey` record for the new key. Keep both.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog the Return-Path label Postmark uses.
- PostHog's DKIM records have their own names, so they sit next to Postmark's `pm._domainkey` record.
- Keep the one `_dmarc` record. Never add a second one.
- Postmark needs no SPF record on the domain itself: its Return-Path covers SPF. A domain whose SPF record names `include:spf.mtasv.net`, from an older Postmark setup, keeps it. Merge PostHog's include into that record, or into whatever `v=spf1` record the domain has.

## Migration token

Postmark's Server API tokens can't be limited to reads: each one can send mail and change the server's settings. The app's own token can read templates and suppressions, but the run doesn't use it. When the person chooses the API over the dashboard, ask them to generate a separate Server API token for the migration on the server the moved sites send from (the server, then API Tokens, then Generate New; a server holds up to three tokens), store it in `POSTMARK_MIGRATION_SERVER_TOKEN` in the git-ignored env file, and note in the plan that the run created it. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the token in Postmark (the server, then API Tokens) and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the token, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template the person moves to PostHog needs the template's content, to check it before they make the PostHog template.

**Copy from the dashboard.** In Postmark: the server, then Templates, then the template. Ask the person for the template's id or alias, its subject, its HTML, and its text body when it has one. When the template uses a layout, ask for the layout's HTML and text too.

**Read from the API.** `GET https://api.postmarkapp.com/templates/{templateIdOrAlias}` with `Accept: application/json` and `X-Postmark-Server-Token: $POSTMARK_MIGRATION_SERVER_TOKEN`. The answer holds `TemplateId`, `Alias`, `Name`, `Subject`, `HtmlBody`, `TextBody`, `TemplateType` (`Standard` or `Layout`), `LayoutTemplate`, and `Active`. When `LayoutTemplate` holds an alias, read that layout with the same route.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which Step 3 deletes once the site is classified. Never write the content into the plan or the report.

## Suppression list

Postmark keeps one suppression list per message stream. It refuses a send to an address on the stream's list with error code `406`. Import the list of `outbound`, the default transactional stream, which the moved sites send through. Each server has its own streams and lists, and each Server API token belongs to one server. When the moved sites send with the tokens of more than one server, import the `outbound` list of each of them, and count the import as complete only when every one is in. Through the API, take one server at a time: read its list with a migration token from that server, then ask the person to delete that token and put the next server's in its place.

**Export from the dashboard (preferred).** In Postmark: the server, then the `outbound` stream, then Suppressions, then **Export**. It saves a JSON file. Ask the person where they saved it. Read its fields to find each entry's address and reason.

**Read from the API.** `GET https://api.postmarkapp.com/message-streams/outbound/suppressions/dump` with `Accept: application/json` and `X-Postmark-Server-Token: $POSTMARK_MIGRATION_SERVER_TOKEN`. It answers `{ "Suppressions": [{ "EmailAddress", "SuppressionReason", "Origin", "CreatedAt" }] }` for the whole stream in one call, with no paging. Wait and retry on `429`.

**Map each entry.**

| `SuppressionReason` | PostHog source | Reason |
|---|---|---|
| `HardBounce` | bounce | `Imported from Postmark: hard bounce` |
| `SpamComplaint` | complaint | `Imported from Postmark: spam complaint` |
| `ManualSuppression` | manual | `Imported from Postmark: manual suppression` |

`ManualSuppression` covers an address the app or a person at Postmark suppressed, and a recipient who unsubscribed from the stream. Each one stopped this stream's mail at Postmark, so each one moves.

**Leave out the other lists.**

- **Broadcast streams** hold the suppressions of marketing mail, such as unsubscribes from a newsletter. PostHog's opt-outs apply to marketing messages only, and transactional email ignores them. At Postmark they never stopped the `outbound` stream's mail, so nothing changes for them when the sends move.
- **Other transactional streams** belong to the sites that send through them, and those sites stay on Postmark. Leave their lists where they are.
