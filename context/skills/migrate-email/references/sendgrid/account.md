# SendGrid account

What the migration needs from the person's SendGrid account. The agent never changes the account: it reads what the person exports or allows.

**EU subusers.** An app on an EU subuser sends through `api.eu.sendgrid.com`, or sets the client's data residency to `eu`, as `sdk-reference.md` says. For such an app, use `api.eu.sendgrid.com` in every request of this file instead of `api.sendgrid.com`.

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

A send follows the account's open and click tracking for each of the two that its `trackingSettings` doesn't set. What PostHog does with opens and clicks is in `mapping.md` under "Open and click tracking". Ask the person once whether open tracking and click tracking are on in SendGrid (Settings, then Tracking). When open tracking is off, the sites that follow it stay, and the reason is `open tracking off`. Each moved site that follows the account's click tracking gets the plan note that section names for its clicks. When the person can't say whether open tracking is on, the sites that follow it stay, and the reason is `account tracking not checked`. When they can't say whether click tracking is on, the sites that follow it count as clicks not known. Note the answer in the plan.

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

**Leave out the other lists.**

- **Blocks** are temporary refusals by a receiving server, not a sign that the address is bad.
- **Global unsubscribes and group unsubscribes** are marketing preferences, and PostHog's opt-outs apply to marketing messages only. At SendGrid a global unsubscribe also stopped transactional mail, unless the send bypassed it. Once the sends move, these addresses get transactional email again. The report gives their count, as "For the report" says.

## For the report

The count of global unsubscribes and of group unsubscribes, which the import leaves out. Count the rows of the person's exports (Suppressions, then each of Global Unsubscribes and Group Unsubscribes, then **Export CSV**), or the entries of `GET https://api.sendgrid.com/v3/suppression/unsubscribes`, paged as above, and of `GET https://api.sendgrid.com/v3/asm/suppressions`, with the read-only key. When the person has neither, write `unsubscribes not counted`.
