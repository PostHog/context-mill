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

## Suppression list

Resend suppresses an address after a hard bounce or a spam complaint, and keeps addresses the team added by hand.

**Export from the dashboard (preferred).** In Resend: Emails, then Suppressions, then **Download CSV**. Read the header row to find the address column and the origin column.

**Read from the API.** `GET https://api.resend.com/suppressions?limit=100` with `Authorization: Bearer $RESEND_SUPPRESSIONS_API_KEY`.

- The answer is `{ "object": "list", "has_more": <bool>, "data": [{ "id", "email", "origin", "source_id", "created_at" }] }`.
- Page with `after=<id of the last entry>` until `has_more` is `false`.
- Resend allows 10 requests per second per team. Wait and retry on `429`.
- A sending-only key can't read the list. Ask the person to create a full-access key, store it in `RESEND_SUPPRESSIONS_API_KEY` for the import, and delete the key in Resend afterwards.

**Map each entry.**

| Resend `origin` | PostHog source | Reason |
|---|---|---|
| `bounce` | bounce | `Imported from Resend: hard bounce` |
| `complaint` | complaint | `Imported from Resend: spam complaint` |
| `manual` | manual | `Imported from Resend: added by hand` |

**Leave out unsubscribed contacts.** A Resend contact with `unsubscribed: true` still gets transactional email, and PostHog's opt-outs apply to marketing messages only. They are not suppressions.
