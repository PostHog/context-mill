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

Postmark's Server API tokens can't be limited to reads: each one can send mail and change the server's settings, and each one reads only its own server. The app's own token can read templates, tracking settings, and suppressions, but the run doesn't use it. When the person chooses the API over the dashboard, ask them to generate a separate Server API token for the migration on each server the moved sites send from (the server, then API Tokens, then Generate New; a server holds up to three tokens). Store it in the git-ignored env file: `POSTMARK_MIGRATION_SERVER_TOKEN` for one server, or `POSTMARK_MIGRATION_SERVER_TOKEN_<SERVER>`, with the server's name in upper snake case, for each of several. Write each one into the plan as Step 3's plan layout says, with its server. Every read below uses the token of the server it reads from.

A migration token lives from the first read of its server to the end of Step 5. Step 3 reads templates and tracking settings with it, and Step 5 imports the suppression list with it. Ask for each token when the first read of its server needs it, and keep it until then. When Step 5 asks the person to delete the full-access key, that is each migration token: in Postmark, the server, then API Tokens. The report reminds them of each token they didn't delete. Never print a token, and never write it into another file.

The steps call these keys the full-access provider key.

## Tracking settings

A site that leaves out `TrackOpens` or `TrackLinks` sends with its server's setting, as `mapping.md` says under "Tracking". Step 3 reads open tracking here for "Opens the provider didn't track": a server whose open tracking is off sent its sites' emails with no open pixel, and a setting nobody gives means nobody can tell.

**Ask the person.** In Postmark: the server, then Settings. It shows whether open tracking and link tracking are on, and which parts link tracking covers.

**Click tracking.** For a site that moves to a template made in PostHog, Postmark didn't track its clicks unless it tracked every link of the email. It tracked none, or only some:

- When its links were untracked, by the send's own `TrackLinks: None`, a `postmarker` or .NET SDK default, or a server whose link tracking is off, as `mapping.md` says under "Tracking".
- When the send's `TrackLinks`, or the server's setting it follows, is `HtmlOnly` and the text body holds a link, or `TextOnly` and the HTML body holds one: each tracks the links of one body only. An email whose links all sit in the tracked body had every link tracked.
- When a link in the template's HTML carries `data-pm-no-track`: Postmark left that link, and the same link in the text, as it was.

When its links follow a server whose link tracking setting is not given, nobody knows, as Step 3 says under "A template in PostHog".

**Read from the API.** `GET https://api.postmarkapp.com/server` with `Accept: application/json` and `X-Postmark-Server-Token` set to the migration token of that server. The answer holds `TrackOpens`, a boolean, `TrackLinks`: `None`, `HtmlAndText`, `HtmlOnly`, or `TextOnly`, and `DeliveryType`: `Live`, or `Sandbox` for a server that delivers nothing.

## Sender signatures

A send that leaves out `ReplyTo` takes the Reply-To address of its `From` address's sender signature, as `mapping.md` says under "Reply-to of the sender signature".

**Ask the person.** In Postmark: Sender Signatures, then the address. It shows the signature's Reply-To address when it has one. An address that is not listed there, such as one a verified domain covers, has no sender signature of its own.

The API reads sender signatures only with the account's Account API token (`GET /senders`), which can change every server of the account. Never ask for that token.

## Template content

A site whose template moves needs the content of the template and of its layout: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content: the subject, the HTML, and the text as they are stored, in Mustachio, with the `<style>` blocks not yet inlined.

**Copy from the dashboard.** In Postmark: the server the site sends from, then Templates, then the template. Ask the person for the template's id or alias, its subject, its HTML, and its text body when it has one. When the template uses a layout, ask for the layout's HTML and text too.

**Read from the API.** `GET https://api.postmarkapp.com/templates/{templateIdOrAlias}` with `Accept: application/json` and `X-Postmark-Server-Token` set to the migration token of the server the site sends from: each server has its own templates, and an id or alias finds only that server's. The answer holds `TemplateId`, `Alias`, `Name`, `Subject`, `HtmlBody`, `TextBody`, `TemplateType` (`Standard` or `Layout`), `LayoutTemplate`, and `Active`. When `LayoutTemplate` holds an alias, read that layout with the same route and token.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

## Suppression list

Postmark keeps one suppression list per message stream. It refuses a send to an address on the stream's list with error code `406`. Import the list of `outbound`, the default transactional stream, which the moved sites send through. Each server has its own streams and lists. When the moved sites send from more than one server, the person agreed in Step 3 that they share one list, as `mapping.md` says under "Servers": import the `outbound` list of each of those servers, and count the import as complete only when every one is in. Through the API, read each server's list with that server's migration token.

**Export from the dashboard (preferred).** In Postmark: each server, then its `outbound` stream, then Suppressions, then **Export**. It saves a JSON file. Ask the person where they saved it. Read its fields to find each entry's address and reason.

**Read from the API.** `GET https://api.postmarkapp.com/message-streams/outbound/suppressions/dump` with `Accept: application/json` and `X-Postmark-Server-Token` set to the server's migration token. It answers `{ "Suppressions": [{ "EmailAddress", "SuppressionReason", "Origin", "CreatedAt" }] }` for the whole stream in one call, with no paging. Wait and retry on `429`.

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
