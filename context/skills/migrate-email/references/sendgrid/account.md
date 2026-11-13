# SendGrid account

What the migration needs from the person's SendGrid account. The agent never changes the account: it reads what the person exports or allows.

**EU subusers.** An app on an EU subuser sends through `api.eu.sendgrid.com`, or sets the client's data residency to `eu`, as `sdk-reference.md` says. For such an app, use `api.eu.sendgrid.com` in every request of this file instead of `api.sendgrid.com`.

**Subusers.** A send uses the suppression lists, templates, and settings of the account its API key belongs to: the parent account or one of its subusers. SendGrid's `on-behalf-of` header, which a client's subuser option such as `setImpersonateSubuser` in Node.js or `GetRequestSubuser` in Go sets, doesn't work with the Mail Send API, so it never sends for another account. Ask the person which account the app's sending key belongs to, make the read-only key below in that account, and switch to that account in SendGrid for every question and export of this file. When sites send with keys of different accounts, or a site picks its key at run time, such as per tenant, ask the person which account's lists Step 5 imports: the sites that send only with that account's key move, and every other site stays, with the reason `sends for another SendGrid account`. When the person can't say which account a key belongs to, its sites stay, with the reason `SendGrid account not checked`.

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

The app's own SendGrid key is usually a key with the Mail Send permission only, and it can't read templates or suppressions. When the person chooses the API over the dashboard, ask them to create a restricted key in SendGrid (Settings, then API Keys) with read access to Template Engine and Suppressions only, store it in `SENDGRID_READ_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in SendGrid and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Tracking

A send follows the account's open and click tracking for each of the two that its `trackingSettings` doesn't set. What PostHog does with opens and clicks is in `mapping.md` under "Open and click tracking". Ask the person once whether open tracking and click tracking are on in SendGrid (Settings, then Tracking), and whether click tracking also covers plain-text emails, and note the answers in the plan.

A site's emails had no open pixel when its `trackingSettings` sets `openTracking` with `enable: false`, or sets no `openTracking` while the account's open tracking is off. When it sets none and the person can't say whether open tracking is on, nobody can tell whether they had one. Step 3 says under "Opens the provider didn't track" what either means.

SendGrid didn't track a site's clicks when its `trackingSettings` sets `clickTracking` with `enable: false`, or sets no `clickTracking` while the account's click tracking is off. It didn't track the links in a plain-text part either, unless `clickTracking` sets `enableText: true`, or sets no `clickTracking` while the account's click tracking covers plain-text emails: a site whose plain-text part has a link SendGrid didn't track counts as one whose clicks SendGrid didn't track. When it sets no `clickTracking` and the person can't say whether click tracking is on, or whether it covers plain text for a site whose plain-text part has a link, nobody knows whether SendGrid tracked them. Step 3 says under "A template in PostHog" what either means for a site that moves to a template made in PostHog.

## Mail settings

More account settings change every send that doesn't set them, and no send field of PostHog's does the same. In the same question, ask the person whether each one is on in SendGrid:

- **Subscription tracking** (Settings, then Tracking): SendGrid added an unsubscribe link to each email, or filled the tag that stands for it. When it is on, every site whose `trackingSettings` doesn't set `subscriptionTracking` stays, and the reason is `account subscription tracking on`.
- **Google Analytics** (Settings, then Tracking): SendGrid added `utm_` parameters to every link. When it is on, every site whose `trackingSettings` doesn't set `ganalytics` stays, and the reason is `account google analytics on`.
- **Legacy Email Template** (Settings, then Mail Settings, when the account shows it): SendGrid wrapped every email in that template. When it is on, every site stays, and the reason is `account legacy email template on`.
- **Footer** (Settings, then Mail Settings): SendGrid appended the footer's HTML to the HTML part and its text to the text part. When it is on, ask the person for the footer's HTML and text. Each site that moves in the code form appends them to its `html` and `text`, as SendGrid did, and the plan notes it. A site that moves to a template made in PostHog sends no `html` or `text`: ask the person to put the footer at the end of that template too, and note it in the plan. When the person can't give the footer, every site stays, and the reason is `account footer not copied`.

When the person can't say whether one of these is on, the sites it would change stay, and the reason is `account mail settings not checked`. Note the answers in the plan.

## Template content

A site whose template moves needs the content of its active version: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content.

**Copy from the dashboard.** In SendGrid: Email API, then Dynamic Templates, then the template, then its active version. Ask the person for the template's id, the version's subject, its HTML from the code editor, and its plain text when it has one.

**Read from the API.** `GET https://api.sendgrid.com/v3/templates/{template_id}` with `Authorization: Bearer $SENDGRID_READ_API_KEY`. The answer holds `id`, `name`, `generation` (`dynamic` or `legacy`), and `versions`, a list of `{ id, active, name, subject, html_content, plain_content }`. Take the version whose `active` is `1`.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

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

**Leave out what SendGrid delivered to anyway.** "For the report" asks the person about the Address Allow List and Bounce Purge. Apply each one on its own:

- **Address Allow List** on: leave out every entry of the lists whose address or domain is on it.
- **Bounce Purge** on: leave out each bounce older than its number of days from its `created` time. A `status` that starts with `5` is a hard bounce, and one that starts with `4` is a soft one.

A setting the person can't say is on, or whose entries or day counts they can't give, leaves out nothing, and the other one still applies.

**Leave out the other lists.**

- **Blocks** are temporary refusals by a receiving server, not a sign that the address is bad.
- **Global unsubscribes and group unsubscribes** are marketing preferences, and PostHog's opt-outs apply to marketing messages only. At SendGrid a global unsubscribe also stopped transactional mail, unless the send bypassed it. Once the sends move, these addresses get transactional email again. The report gives their count, as "For the report" says.

## For the report

The count of global unsubscribes and of group unsubscribes, which the import leaves out. Count the rows of the person's exports (Suppressions, then each of Global Unsubscribes and Group Unsubscribes, then **Export CSV**), or the entries of `GET https://api.sendgrid.com/v3/suppression/unsubscribes`, paged as above, and of `GET https://api.sendgrid.com/v3/asm/suppressions`, with the read-only key. When the person has neither, write `unsubscribes not counted`.

Ask the person once, whether or not the import runs and in a re-import too, whether two settings are on in SendGrid (Settings, then Mail Settings). With the **Address Allow List**, SendGrid delivered to an address on it, or at a domain on it, whatever its lists said. With **Bounce Purge**, SendGrid deleted a bounce once it was older than the days set for hard bounces or for soft bounces. For each one that is on, ask for its entries, or for its two day counts. Then write:

- When Bounce Purge is on: bounces that SendGrid would have purged later stay suppressed in PostHog until someone removes them.
- When the person can't say whether one of them is on, or can't give its entries or day counts, a "Before cutover" task: check that setting in SendGrid, and when it is on, remove from PostHog's suppression list the entries that "Leave out what SendGrid delivered to anyway" names for it.
- When the import tool is missing and the person adds the entries by hand, a "Before cutover" task: leave out the entries that "Leave out what SendGrid delivered to anyway" names.
