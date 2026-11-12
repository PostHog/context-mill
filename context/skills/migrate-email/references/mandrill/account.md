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

The app's own Mailchimp Transactional key can usually call every API method, but some keys are limited to the send calls. Never use the app's key for reads. When the person chooses the API over the dashboard, ask them to create a new key in Mailchimp Transactional (Settings, then **+ New API Key**) and limit it to the API calls `templates/info`, `templates/list`, `mctemplates/info`, and `rejects/list`. Ask them to store it in `MANDRILL_READ_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Its last use is the suppression import in Step 5, or the re-import that created it. At the end of that step, on every way out of it, ask the person to delete the key in Mailchimp Transactional and remove its variable from the env file, as Step 5 says under "The full-access key". The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Sending defaults

A send that doesn't set a field takes the account's Sending Defaults. Ask the person for these settings on the Sending Defaults page (Settings, then Sending Defaults), and note them in the plan:

- open tracking and click tracking, for `track_opens` and `track_clicks`;
- **Inline CSS Styles In HTML Emails**, for `inline_css`;
- the box that generates an HTML part for text emails, for `auto_html`;
- **Add Unsubscribe Footer**. A moved send gets no such footer: when it is on, note it in the report;
- **Merge Language**, for `merge_language`.

The API has no read of these settings. Note the click tracking choice as the page names it, such as HTML emails only. Open tracking off in the Sending Defaults means a site that leaves out `track_opens` had no open pixel, and a person who can't tell the setting means nobody can tell, as `mapping.md` says under "Tracking" and Step 3 under "Opens the provider didn't track". When the person can't tell the inline CSS setting, a site that doesn't set `inline_css` stays when its HTML has a `<style>` element, or the code doesn't show that it has none, and the reason is `account inline CSS not checked`. When they can't tell the HTML setting, a site that doesn't set `auto_html` and sends no `html` stays, and the reason is `account HTML part not checked`. When they can't tell the merge language, a site whose content has a merge tag stays, as "Templates" in `mapping.md` says.

Also ask the person whether the account has rules (the Rules page under Settings), and what each active rule matches and changes. A rule changes each send it matches, such as turning open tracking off, adding tags, or moving the send to a subaccount. Classify a site that a rule matches with the rule's changes, as if the site set them. A site that a rule may match, when the person can't tell what the rule changes, stays, and the reason is `sending rule not checked`. When the person can't tell whether the account has rules, every site stays for the same reason.

## Click tracking

Mailchimp Transactional tracked a site's clicks when the send's `track_clicks` is `true`, or, when the send leaves it out, when the Sending Defaults' click tracking covers the email's part, as `mapping.md` says under "Tracking", and no rule the person names turns it off. A `track_clicks: false`, click tracking off in the Sending Defaults, or a choice that leaves out the email's part, such as text emails only for an HTML email, means it didn't track the site's clicks. When the site leaves out `track_clicks` and the person can't tell the Sending Defaults' click tracking, nobody knows. Step 3 says under "A template in PostHog" what a site that moves to a template made in PostHog then needs.

## Template content

A site whose template moves needs the content of its published version: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content, as HTML and text with the merge tags as written.

**Copy from the dashboard.** In Mailchimp Transactional: the Templates page, then the template. Ask the person for the template's slug, its published subject, from address and from name, its HTML, and its text when it has one.

**Read from the API.** `POST https://mandrillapp.com/api/1.4/templates/info` with the JSON body `{ "key": "<MANDRILL_READ_API_KEY>", "name": "<template slug>" }`. The answer holds `slug`, `name`, `labels`, the draft fields `code`, `text`, `subject`, `from_email`, and `from_name`, and the published fields `publish_code`, `publish_text`, `publish_subject`, `publish_from_email`, and `publish_from_name`. Take the published fields: sends use them.

**A Mailchimp template.** A `messages.sendMcTemplate` site sends a template by its `mc_template_id`. Read it with `POST https://mandrillapp.com/api/1.4/mctemplates/info` and the JSON body `{ "key": "<MANDRILL_READ_API_KEY>", "mc_template_id": <id> }`. The answer holds `subject`, `from_email`, `from_name`, the draft `code` and `text`, and the published `publish_code` and `publish_text`. Take the published ones, or the draft ones when the site sets `mc_template_version: 'draft'`. Or ask the person to copy the same fields from the template in their Mailchimp account.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

## Suppression list

Mailchimp Transactional keeps one suppression list, the Rejection Denylist, and a separate one for each subaccount. It rejects an address on the list on every send until the entry expires. A subaccount's entries apply only to that subaccount's sends, and those sends stay on Mailchimp Transactional (see `mapping.md`). So import only the main account's entries: an entry with a subaccount would block a moved send that Mailchimp Transactional let through. A soft bounce expires after 24 hours, a hard bounce after seven days, a spam complaint and an unsubscribe after a year, and a custom entry, one the person added, never.

**Export from the dashboard (preferred).** In Mailchimp Transactional: the Rejection Denylist page under Settings, then **Export Full Denylist**. The export is queued, and the account's contact address gets an email when it is ready. The person downloads it from that email or from the Exports page under Settings, within seven days. It is a zip file with one `rejects.csv`, with the subaccount entries in their own column. Ask the person where they saved the file. Read the header row to find the address, reason, expiry, and subaccount columns.

**Read from the API.** `POST https://mandrillapp.com/api/1.4/rejects/list` with the JSON body `{ "key": "<MANDRILL_READ_API_KEY>", "include_expired": false }`. It answers a list of `{ email, reason, detail, created_at, last_event_at, expires_at, expired, sender, subaccount }`, and leaves out entries that expired. It has no paging and answers at most 1,000 entries: when it answers 1,000, the list is longer, so stop and ask the person for the dashboard export instead. Wait and retry on `429`.

**Map each entry.** Take only entries that have not expired and have no subaccount.

| Rejection reason | PostHog source | Reason |
|---|---|---|
| `hard-bounce` | bounce | `Imported from Mailchimp Transactional: hard bounce` |
| `spam` | complaint | `Imported from Mailchimp Transactional: spam complaint` |
| `custom` | manual | `Imported from Mailchimp Transactional: custom rejection` |

**Leave out the other entries.**

- **Soft bounces** are temporary refusals by a receiving server. Mailchimp Transactional lets them expire after a day and sends to the address again.
- **Expired entries** are addresses Mailchimp Transactional sends to again.
- **Unsubscribes** come from an unsubscribe link or the recipient's mail program, and block only the one sender address they unsubscribed from. PostHog's opt-outs apply to marketing messages only, so once the sends move, these addresses get transactional email again. "For the report" counts them.

## For the report

Step 5 writes these under the phase, whether or not the import runs:

- How many of the main account's unsubscribe entries that have not expired the import leaves out: entries whose reason is `unsub`, counted in the export or the API's answer. When the person has neither, write that the count is not known.
- That PostHog keeps an imported entry until someone removes it, where Mailchimp Transactional let a hard bounce expire after seven days and a spam complaint after a year, so these addresses stay blocked for the moved sends.
