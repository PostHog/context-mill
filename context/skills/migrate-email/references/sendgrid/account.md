# SendGrid account

What the migration needs from the person's SendGrid account. The agent never changes the account: it reads what the person exports or allows.

## DNS records

A domain authenticated at SendGrid carries these records. Keep all of them until the cutover is done. The SendGrid dashboard shows the exact names under Settings, then Sender Authentication.

| Record | Name | What it does |
|---|---|---|
| `CNAME` | `em<digits>`, such as `em1234` | Return path for SendGrid's bounces, and its SPF |
| `CNAME` (DKIM) | `s1._domainkey`, `s2._domainkey` | Signs SendGrid's mail |
| `CNAME` | `url<digits>` and a second label of digits | Link branding, only when it is set up |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- A domain set up without automated security has an `MX` and an SPF `TXT` record on `em<digits>`, and a DKIM `TXT` record at `m1._domainkey`, in place of the CNAMEs.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label SendGrid uses.
- PostHog's DKIM records have their own names, so they sit next to `s1._domainkey` and `s2._domainkey`.
- Keep the one `_dmarc` record. Never add a second one.
- A domain whose SPF record names `include:sendgrid.net` keeps it. Merge PostHog's include into that record.

## Read-only key

The app's own SendGrid key is usually a key with the Mail Send permission only, and it can't read templates or suppressions. When the person chooses the API over the dashboard, ask them to create a restricted key in SendGrid (Settings, then API Keys) with read access to Template Engine and Suppressions only, store it in `SENDGRID_READ_API_KEY` in the git-ignored env file, and note in the plan that the run created it. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in SendGrid and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template the person moves to PostHog needs the content of its active version, to check it before they make the PostHog template.

**Copy from the dashboard.** In SendGrid: Email API, then Dynamic Templates, then the template, then its active version. Ask the person for the template's id, the version's subject, its HTML from the code editor, and its plain text when it has one.

**Read from the API.** For an EU subuser, whose app sends through `api.eu.sendgrid.com`, use that host in every request of this file instead of `api.sendgrid.com`.

`GET https://api.sendgrid.com/v3/templates/{template_id}` with `Authorization: Bearer $SENDGRID_READ_API_KEY`. The answer holds `id`, `name`, `generation` (`dynamic` or `legacy`), and `versions`, a list of `{ id, active, name, subject, html_content, plain_content }`. Take the version whose `active` is `1`.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which Step 3 deletes once the site is classified. Never write the content into the plan or the report.

## Suppression list

SendGrid keeps several suppression lists. It skips an address on any of them on every send.

**Export from the dashboard (preferred).** In SendGrid: Suppressions, then each of Bounces, Spam Reports, and Invalid Emails, then **Export CSV**. Ask the person where they saved each file. Read the header row to find the address column.

**Read from the API.** With `Authorization: Bearer $SENDGRID_READ_API_KEY`:

- `GET https://api.sendgrid.com/v3/suppression/bounces`
- `GET https://api.sendgrid.com/v3/suppression/spam_reports`
- `GET https://api.sendgrid.com/v3/suppression/invalid_emails`

Each answers a list of `{ created, email, reason, status }`. Page with `limit=500` and `offset`, adding 500 each time, until a page has fewer than 500 entries. Wait and retry on `429`.

**Map each entry.**

| SendGrid list | PostHog source | Reason |
|---|---|---|
| Bounces | bounce | `Imported from SendGrid: bounce` |
| Invalid Emails | bounce | `Imported from SendGrid: invalid address` |
| Spam Reports | complaint | `Imported from SendGrid: spam report` |

**Leave out the other lists.**

- **Blocks** are temporary refusals by a receiving server. SendGrid retries those addresses, and so does PostHog.
- **Global unsubscribes and group unsubscribes** are marketing preferences, and PostHog's opt-outs apply to marketing messages only. At SendGrid a global unsubscribe also stopped transactional mail, unless the send bypassed it. Once the sends move, these addresses get transactional email again. Count them, and tell the person the count in the report.
