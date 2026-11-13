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

The steps never read the app's own key from its env file. When the person chooses the API over the dashboard, ask them to generate a new API key for this migration in Brevo (Settings, then SMTP & API, then API keys) with restricted access: Transactional email set to Read, and every other permission set to None. Read lets the key read templates, blocked contacts and blocked domains, and never send, change or delete anything. When Brevo refuses a read for the key's permissions, ask the person to give it Read on the permission the error names, and nothing more. When their account offers no restricted key, a key with full access works the same. Ask them to store it in `BREVO_MIGRATION_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in Brevo and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

Brevo can block API calls from IP addresses it doesn't know. It turns this on by itself once no new address has called the API for 30 days. When Brevo refuses a read because of the IP address, ask the person to authorize this machine's address in Brevo (Settings, then Security, then Authorized IPs), and to remove it when they delete the key. Don't retry the read until they have.

The steps call this key the full-access provider key, even when it is restricted: Step 5 still asks the person to delete it.

## Tracking settings

A send that sets no `contactPixelTrackingConsent` follows the account's tracking, as `mapping.md` says under "Tracking". The API doesn't show these settings. Ask the person once, and note the answers in the plan:

- Whether anonymous email tracking is on for transactional emails: Settings, then Automations, then Transactional emails, then Tracking.
- Whether per-contact pixel tracking consent is on: Settings, then Contacts, then Per-contact pixel tracking consent.
- Whether Brevo turned off open tracking, click tracking, or both for the account. Open tracking off means the site's emails had no open pixel, and no answer means nobody knows whether they had one, as Step 3 says under "Opens the provider didn't track". Click tracking off means Brevo didn't track the site's clicks, and no answer means nobody knows, as Step 3 says under "A template in PostHog".

## Template content

A site whose template moves needs the template's content: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content as HTML, with the subject and the sender, but not the attachment.

**Copy from the dashboard.** In Brevo's list of email templates, the template's id is the number after `#` in its name. Ask the person for the template's id, its subject, its sender and reply-to address, its "To" field when it is not the default, its tag, whether it is active or inactive, its HTML from the template's code editor, and whether it has an attachment under "Show Advanced Options".

**Read from the API.** `GET https://api.brevo.com/v3/smtp/templates/{templateId}` with the header `api-key: $BREVO_MIGRATION_API_KEY`. The answer holds `id`, `name`, `subject`, `isActive`, `htmlContent`, `sender` (`{ name, email, id }`), `replyTo`, `toField`, and `tag`. It doesn't show the template's attachment: ask the person whether the template has one, as above. On the general rate limit tier Brevo allows 300 requests an hour to this route: read only the templates the sites send.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report. A copy from the dashboard that takes the place of a deleted one goes through Step 3's template check before Step 7 uses it: when it fails, the site stays, and the reason is the one that check names. Without a copy, the site stays, and the reason is `template content not checked`.

## Suppression list

Brevo keeps one list of blocked transactional contacts. It skips an address on it for every transactional send, or, for an admin block or an unsubscribe that names a sender, for sends from that sender. Each entry has a reason code.

**What Step 3 asks about.** Brevo keeps a suppression list, so Step 3 asks which sites rely on it. Besides the addresses added by hand in the dashboard and by the calls `mapping.md` names under "Calls that change the blocked list", Brevo adds an address when its recipient unsubscribes through the link in a transactional email or a Brevo automation, and it blocks every address on a domain blocked at Brevo. Name these in Step 3's question too: a moved send reaches each of them, as "Blocked domains" says for the domains. Step 3 asks this before it reads any template, so get the blocked domains first: ask the person once whether to read them from the API, with the key "Read key" says, which Step 3's template reads reuse, or to read the list in the dashboard themselves. Read the domains as "Blocked domains" says, and name them in the question. When the person does neither, name blocked domains in general in the question.

**From the dashboard.** In Brevo: Settings, then Transactional emails, then Blocked or Unsubscribed contacts. The page lists each address with its reason and its sender. Ask the person whether they saved the list to a file from there, and where. Read the header row to find the address, reason and sender columns. An empty sender means the entry names no sender. The file shows each reason as a label, not as the code below: take a row only when its label names a hard bounce, a spam complaint, a block by an admin, or an unsubscribe, and leave out the rest. When it is unclear whether a label names one of these, ask the person. When they have no file, use the API below, or record the import as not done.

**Read from the API.** `GET https://api.brevo.com/v3/smtp/blockedContacts` with the header `api-key: $BREVO_MIGRATION_API_KEY`. It answers `{ contacts, count }`, and each contact is `{ email, senderEmail, reason: { code, message }, blockedAt }`. Page with `limit=100` and `offset`, adding 100 each time, until a page has fewer than 100 entries or the offset reaches `count`. Wait and retry on `429`, after the seconds the `x-sib-ratelimit-reset` header names, or 60 seconds when it is missing. Branch on `reason.code`, never on `reason.message`.

**Map each entry.**

| Brevo reason code | PostHog `reason` |
|---|---|
| `hardBounce` | `bounce` |
| `contactFlaggedAsSpam` | `complaint` |
| `adminBlocked` | `manual` |
| `unsubscribedViaEmail`, `unsubscribedViaApi`, `unsubscribedViaMA` | `manual` |

Import every address once, whatever sender its entries name: Brevo keeps an entry per sender, so an address can have several, and PostHog keeps the reason an address is first imported with. Read every page or row first, compare addresses without regard to case, and give each address `bounce` when any of its entries is a hard bounce, else `complaint` when any is a spam complaint, else `manual`. PostHog's list holds no sender, so an admin block or an unsubscribe for one sender blocks PostHog's marketing email to the address from every sender. A moved send still reaches it, as Step 5 says. "For the report" counts these entries.

**Leave out the other entries.** Blocked contacts of Brevo's email campaigns, under CRM, then Contacts, are a marketing list, not the transactional one.

## Blocked domains

Brevo can block every address on a domain, set by hand in the dashboard or by a call that `mapping.md` names under "Calls that change the blocked list". PostHog's list takes addresses, not domains, so the import leaves the domains out, and PostHog's sends reach them. Step 3's question covers the sites that rely on them, as "What Step 3 asks about" says.

Read the domains from `GET https://api.brevo.com/v3/smtp/blockedDomains` with the header `api-key: $BREVO_MIGRATION_API_KEY`, which answers `{ domains }`. Without a key, ask the person to read the list in the dashboard, next to the blocked contacts: the blocked contacts file doesn't hold it.

## For the report

Count these whether or not the import runs, and never write an address or a domain:

- the admin blocks and unsubscribes that name one sender, which the import takes as `manual`: PostHog's marketing email no longer reaches those addresses from any sender, as "Map each entry" says;
- the domains Brevo blocks, which the import leaves out: the moved sends reach every address on them, as "Blocked domains" says.

Write a count you can't get as not known.
