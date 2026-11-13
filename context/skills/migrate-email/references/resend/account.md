# Resend account

What the migration needs from the person's Resend account. The agent never changes the account: it reads what the person exports or allows.

## DNS records

A domain verified at Resend carries these records. Keep all of them until the cutover is done.

| Record | Name | What it does |
|---|---|---|
| `TXT` (DKIM) | `resend._domainkey` | Signs Resend's mail |
| `MX` | `send` | Return path for Resend's bounces |
| `TXT` (SPF) | `send` | Allows Resend to send for the return path |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- `send` is Resend's default return-path label. A domain can use a custom one: the Resend dashboard shows it under Domains.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog the label Resend uses.
- PostHog's DKIM records have their own names, so they sit next to `resend._domainkey`.
- Keep the one `_dmarc` record. Never add a second one.

## Full-access key

The app's own Resend key is usually a sending-only key, and it can't read templates or the suppression list. When the person chooses the API over the dashboard, ask them to create a full-access key in Resend, store it in `RESEND_FULL_ACCESS_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in Resend and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

## Template content

A site whose template moves needs the template's content: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content.

**Copy from the dashboard.** In Resend: Templates, then the template. Ask the person for its alias or name, its HTML, its plain text when it has one, its subject, its `from` and reply-to when they are set, and each variable's fallback. A copy can't tell a template without plain text, whose emails get one that Resend makes from the HTML, from one whose plain text is set to an empty string, whose emails go out with none. So when it has no plain text, ask the person which. In Step 3, also offer to make the key that "Full-access key" describes, so you read that template from the API. When neither settles it, the site stays, and the reason is `plain-text part not checked`. However you read a template, from here or from the API, write what its plain text is in its note under the sites table: `text: its own`, `text: made from the HTML`, or `text: none`. A copy made again in Step 7 then needs no new question.

**Read from the API.** `GET https://api.resend.com/templates/{id or alias}` with `Authorization: Bearer $RESEND_FULL_ACCESS_API_KEY`. The answer holds `alias`, `name`, `subject`, `from`, `reply_to`, `html`, `text`, and `variables`, a list of `{ key, type, fallback_value }`.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

## Open tracking

Resend tracks opens per sending domain, only when open tracking is on for it: Domains, then the domain, then Configuration. Ask the person once, for each sending domain of the sites that move, whether open tracking is on: this asks about Resend's setting, never whether PostHog may add its pixel. Off means the site's emails had no open pixel, and no answer means nobody knows whether they had one: either way the site moves with opens off, as Step 3 says under "Opens the provider didn't track".

## Click tracking

Resend tracks clicks per sending domain, only when click tracking is on for it: Domains, then the domain, then Configuration. When a site moves to a template made in PostHog, ask the person once, for each sending domain of such sites, whether click tracking is on. Off means Resend didn't track the site's clicks, and no answer means nobody knows, as Step 3 says under "A template in PostHog".

## Suppression list

Resend suppresses an address after a hard bounce or a spam complaint, and keeps addresses the team added by hand.

**Export from the dashboard (preferred).** In Resend: Emails, then Suppressions, then **Download CSV**. Read the header row to find the address column and the origin column.

**Read from the API.** `GET https://api.resend.com/suppressions?limit=100` with `Authorization: Bearer $RESEND_FULL_ACCESS_API_KEY`.

- The answer is `{ "object": "list", "has_more": <bool>, "data": [{ "id", "email", "origin", "source_id", "created_at" }] }`.
- Page with `after=<id of the last entry>` until `has_more` is `false`.
- Resend allows 10 requests per second per team. Wait and retry on `429`.
- A sending-only key can't read the list. Use the full-access key above.

**Map each entry.**

| Resend `origin` | PostHog `reason` |
|---|---|
| `bounce` | `bounce` |
| `complaint` | `complaint` |
| `manual` | `manual` |

**Leave out unsubscribed contacts.** A Resend contact with `unsubscribed: true` still gets transactional email, and PostHog's opt-outs apply to marketing messages only. They are not suppressions.
