# Brevo account

What the migration needs from the person's Brevo account. The agent never changes the account: it reads what the person exports or allows.

## DNS records

A domain authenticated at Brevo carries these records. Keep all of them until the cutover is done. The Brevo dashboard shows the exact names and values under Senders, Domains, IPs, then Domains.

| Record | Name | What it does |
|---|---|---|
| `TXT` | the domain itself (`@`) | The Brevo code, `brevo-code:<value>`: proves the domain to Brevo |
| `CNAME` (DKIM) | `brevo1._domainkey`, `brevo2._domainkey` | Signs Brevo's mail |
| `TXT` (DMARC) | `_dmarc` | Shared by every provider on the domain |

- A domain authenticated before the DKIM CNAMEs has one DKIM `TXT` record at `mail._domainkey` in their place.
- The Brevo code is one `TXT` value on the root of the domain. It sits next to the domain's other root `TXT` records, such as its SPF record, and PostHog's records don't replace it.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label Brevo uses.
- PostHog's DKIM records have their own names, so they sit next to `brevo1._domainkey`, `brevo2._domainkey`, and `mail._domainkey`.
- Keep the one `_dmarc` record. Never add a second one: Brevo reports an error when a domain has more than one.
- Brevo asks for an SPF record only for a dedicated IP. When the domain has a `v=spf1` record, keep everything in it and merge PostHog's include into it.

## Read key

A Brevo API key can't be limited to some APIs: every key has full access to the account. The app's own key can read templates and the blocked contacts list, but the steps never read the app's key from its env file. When the person chooses the API over the dashboard, ask them to generate a new API key for this migration in Brevo (Settings, then SMTP & API, then API keys), store it in `BREVO_MIGRATION_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in Brevo and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

Brevo can block API calls from IP addresses it doesn't know. It turns this on by itself once no new address has called the API for 30 days. When Brevo refuses a read because of the IP address, ask the person to authorize this machine's address in Brevo (Settings, then Security, then Authorized IPs), and to remove it when they delete the key. Don't retry the read until they have.

The steps call this key the full-access provider key.

## Tracking settings

A send that sets no `contactPixelTrackingConsent` follows the account's tracking, as `mapping.md` says under "Tracking". The API doesn't show these settings. Ask the person once, and note the answers in the plan:

- Whether anonymous email tracking is on for transactional emails: Settings, then Automations, then Transactional emails, then Tracking.
- Whether per-contact pixel tracking consent is on: Settings, then Contacts, then Per-contact pixel tracking consent.
- Whether Brevo turned off open tracking, click tracking, or both for the account.

## Template content

A site whose template moves needs the template's content: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content as HTML, with the subject and the sender, but not the attachment.

**Copy from the dashboard.** In Brevo's list of email templates, the template's id is the number after `#` in its name. Ask the person for the template's id, its subject, its sender and reply-to address, its "To" field when it is not the default, its tag, its HTML from the template's code editor, and whether it has an attachment under "Show Advanced Options".

**Read from the API.** `GET https://api.brevo.com/v3/smtp/templates/{templateId}` with the header `api-key: $BREVO_MIGRATION_API_KEY`. The answer holds `id`, `name`, `subject`, `isActive`, `htmlContent`, `sender` (`{ name, email, id }`), `replyTo`, `toField`, and `tag`. It doesn't show the template's attachment: ask the person whether the template has one, as above. On the general rate limit tier Brevo allows 300 requests an hour to this route: read only the templates the sites send.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report. A copy from the dashboard that takes the place of a deleted one goes through Step 3's template check before Step 7 uses it: when it fails, the site stays, and the reason is the one that check names. Without a copy, the site stays, and the reason is `template content not checked`.

## Suppression list

Brevo keeps one list of blocked transactional contacts. It skips an address on it for every transactional send, or, for an unsubscribe, for sends from the sender it unsubscribed from. Each entry has a reason code.

**From the dashboard.** In Brevo: Settings, then Transactional emails, then Blocked or Unsubscribed contacts. The page lists each address with its reason and its sender. Ask the person whether they saved the list to a file from there, and where. Read the header row to find the address and reason columns. The file shows each reason as a label, not as the code below: take a row only when its label names a hard bounce, a spam complaint, or a block by an admin, and leave out the rest. When it is unclear whether a label names one of these three, ask the person. When they have no file, use the API below, or record the import as not done.

**Read from the API.** `GET https://api.brevo.com/v3/smtp/blockedContacts` with the header `api-key: $BREVO_MIGRATION_API_KEY`. It answers `{ contacts, count }`, and each contact is `{ email, senderEmail, reason: { code, message }, blockedAt }`. Page with `limit=100` and `offset`, adding 100 each time, until a page has fewer than 100 entries or the offset reaches `count`. Wait and retry on `429`, after the seconds the `Retry-After` header names when it has one. Branch on `reason.code`, never on `reason.message`.

**Map each entry.**

| Brevo reason code | PostHog source | Reason |
|---|---|---|
| `hardBounce` | bounce | `Imported from Brevo: hard bounce` |
| `contactFlaggedAsSpam` | complaint | `Imported from Brevo: spam complaint` |
| `adminBlocked` | manual | `Imported from Brevo: blocked by an admin` |

An admin block can cover one sender only: each entry names its sender, in `senderEmail` or the file's sender column. PostHog's list blocks an address for every send, so import an `adminBlocked` address only when it has an admin block for every sender that sends through PostHog: the senders of the moved sites, and each sender the person already sends from with PostHog, which you ask them for once. When a moved site's sender isn't a fixed value, such as a per-tenant address, the senders are the values the person names, and when they can't name them all, import no admin block. Leave out the others.

**Leave out the other entries.**

- **Unsubscribes** (`unsubscribedViaEmail`, `unsubscribedViaApi`, `unsubscribedViaMA`) are preferences, and PostHog's opt-outs apply to marketing messages only. At Brevo they stopped transactional mail from the sender the person unsubscribed from. Once the sends move, these addresses get transactional email again.
- **Blocked domains** (`GET /v3/smtp/blockedDomains`, in the dashboard next to the blocked contacts) block every address on a domain. PostHog's list takes addresses, not domains, so PostHog sends to those domains again.
- Blocked contacts of Brevo's email campaigns, under CRM, then Contacts, are a marketing list, not the transactional one.

## For the report

Count these from the dashboard file or the API, as "Suppression list" says, whether or not the import runs:

- the unsubscribes on the list, which get the moved transactional sends again;
- the admin blocks the import leaves out, because they don't cover every sender that sends through PostHog;
- the blocked domains, which PostHog sends to again.

When the person has neither the file nor a key, write that these counts are not known.
