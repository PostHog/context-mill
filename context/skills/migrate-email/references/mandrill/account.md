# Mailchimp Transactional account

What the migration needs from the person's Mailchimp Transactional account. The agent never changes the account: it reads what the person exports or allows.

## DNS records

A sending domain at Mailchimp Transactional carries these records. Keep all of them until the cutover is done. The dashboard shows the exact values under Settings, then Domains.

| Record | Name | What it does |
|---|---|---|
| `CNAME` (DKIM) | `mte1._domainkey`, `mte2._domainkey` | Signs Mailchimp Transactional's mail. They point to `dkim1.mandrillapp.com` and `dkim2.mandrillapp.com` |
| `TXT` | On the domain, with a value that starts `mandrill_verify.` | Proves the person owns the domain |
| `TXT` (DMARC) | `_dmarc` | Required by Mailchimp Transactional, and shared by every provider on the domain |
| `CNAME` | A subdomain that points to `mandrillapp.com` | A custom tracking or return-path domain, only when it is set up (Settings, then Tracking & Return Path Domains) |

- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label Mailchimp Transactional uses, such as a tracking or return-path subdomain.
- PostHog's DKIM records have their own names, so they sit next to `mte1._domainkey` and `mte2._domainkey`.
- Keep the one `_dmarc` record. Never add a second one.
- Mailchimp Transactional needs no SPF record. A domain whose SPF record names `include:spf.mandrillapp.com` or `include:mandrillapp.com` keeps it. Merge PostHog's include into that record.

## Read-only key

The app's own Mailchimp Transactional key can usually call every API method, but some keys are limited to the send calls. Never use the app's key for reads. When the person chooses the API over the dashboard, ask them to create a new key in Mailchimp Transactional (Settings, then **+ New API Key**) and limit it to the API calls `templates/info`, `templates/list`, and `rejects/list`. Ask them to store it in `MANDRILL_READ_API_KEY` in the git-ignored env file, and note in the plan that the run created it. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in Mailchimp Transactional and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template the person moves to PostHog needs the content of its published version, to check it before they make the PostHog template.

**Copy from the dashboard.** In Mailchimp Transactional: the Templates page, then the template. Ask the person for the template's slug, its published subject, from address and from name, its HTML, and its text when it has one. Ask them which merge language the account uses by default (Sending Defaults, then Merge Language) when the site doesn't set `merge_language`.

**Read from the API.** `POST https://mandrillapp.com/api/1.4/templates/info` with the JSON body `{ "key": "<MANDRILL_READ_API_KEY>", "name": "<template slug>" }`. The answer holds `slug`, `name`, `labels`, the draft fields `code`, `text`, `subject`, `from_email`, and `from_name`, and the published fields `publish_code`, `publish_text`, `publish_subject`, `publish_from_email`, and `publish_from_name`. Take the published fields: sends use them.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which Step 3 deletes once the site is classified. Never write the content into the plan or the report.

## Suppression list

Mailchimp Transactional keeps one suppression list, the Rejection Denylist, and a separate one for each subaccount. It rejects an address on the list on every send until the entry expires. A soft bounce expires after 24 hours, a hard bounce after seven days, a spam complaint and an unsubscribe after a year, and a custom entry, one the person added, never.

**Export from the dashboard (preferred).** In Mailchimp Transactional: the Rejection Denylist page under Settings, then **Export Full Denylist**. The export is queued, and the account's contact address gets an email when it is ready. The person downloads it from that email or from the Exports page under Settings, within seven days. It is a zip file with one `rejects.csv`, with the subaccount entries in their own column. Ask the person where they saved the file. Read the header row to find the address, reason, and expiry columns.

**Read from the API.** `POST https://mandrillapp.com/api/1.4/rejects/list` with the JSON body `{ "key": "<MANDRILL_READ_API_KEY>", "include_expired": false }`. It answers a list of `{ email, reason, detail, created_at, last_event_at, expires_at, expired, sender, subaccount }`, and leaves out entries that expired. It has no paging and answers at most 1,000 entries: when it answers 1,000, the list is longer, so stop and ask the person for the dashboard export instead. For each subaccount, call it again with `"subaccount": "<id>"`. Wait and retry on `429`.

**Map each entry.** Take only entries that have not expired.

| Rejection reason | PostHog source | Reason |
|---|---|---|
| `hard-bounce` | bounce | `Imported from Mailchimp Transactional: hard bounce` |
| `spam` | complaint | `Imported from Mailchimp Transactional: spam complaint` |
| `custom` | manual | `Imported from Mailchimp Transactional: custom rejection` |

**Leave out the other entries.**

- **Soft bounces** are temporary refusals by a receiving server, and expire after a day. PostHog retries those addresses too.
- **Expired entries** are addresses Mailchimp Transactional sends to again.
- **Unsubscribes** come from an unsubscribe link or the recipient's mail program, and block only the one sender address they unsubscribed from. PostHog's opt-outs apply to marketing messages only, so once the sends move, these addresses get transactional email again. Count them, and tell the person the count in the report.
