# SMTP account

What the migration needs from the account behind the SMTP host. SMTP is only how the app hands mail over: the provider that runs the host, found from the table in `sdk-reference.md`, holds the DNS records and any suppression list. The agent never changes that account: it reads what the person exports or tells it.

Name that provider in the plan, such as `SMTP host: smtp.mailgun.org (Mailgun)`. When the host comes from a variable with no value in the repository, ask the person which provider runs it. The steps say "the provider" for it.

**Region.** The agent sends no request to the provider: the person reads its dashboard. When the host is regional, as `sdk-reference.md` says, the domain records and the suppression list belong to the account in that region. Tell the person to open the provider's dashboard in that region. For Amazon SES, open the console in the region the host names, such as `eu-west-1` for `email-smtp.eu-west-1.amazonaws.com`: SES keeps the suppression list per region. An app that sends through hosts in several regions has a list in each one. Read every region the app's hosts use.

## DNS records

A domain that sends through an SMTP provider carries that provider's records. Keep all of them until the cutover is done, and longer when the domain also gets or sends normal mail. The provider's dashboard shows the exact names, under its domain or sender settings.

| Record | Usual name | What it does |
|---|---|---|
| `TXT` (SPF) | The domain, or the provider's return-path label | Names the servers that may send for the domain, with an `include:` of the provider |
| `TXT` or `CNAME` (DKIM) | `<selector>._domainkey` | Signs the provider's mail. The selector is the provider's own |
| `CNAME` or `MX` | A return-path or bounce label, such as `bounce`, `pm-bounces`, or `em<digits>` | The provider's MAIL FROM, where its bounces go |
| `CNAME` | A tracking label | Link and open tracking, only when it is set up |
| `MX` | The domain | Where the domain's own mail arrives, when it has mailboxes |
| `TXT` (DMARC) | `_dmarc` | Shared by every provider on the domain |

- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label the provider already uses. Check the domain's records for that label first.
- PostHog's DKIM records have their own selector names, so they sit next to the provider's `_domainkey` records.
- Keep the one `_dmarc` record. Never add a second one.
- A domain whose SPF record names the provider's `include:` keeps it. Merge PostHog's include into that record: a domain has one SPF record.
- **Gmail, Google Workspace, Microsoft 365, and other mailbox providers.** The domain's MX, SPF, and DKIM records also carry the person's normal mail. They stay after the cutover. Never suggest removing one.
- **A server the person runs.** Its records are what the person set up, such as an `A` record for the host, an SPF entry for its address, and its own DKIM selector. Keep them, and ask the person when you can't tell which labels it uses.

## Read-only key

A read key is usually not needed. The SMTP password sends mail and reads nothing. The templates are in the app's code, and the suppression list, when the provider keeps one, comes from its dashboard export. Don't ask for a key to the provider's API: this skill has no reference for it, and the steps never need one. The run creates no full-access provider key, so the plan gets no line for one, and Step 5 has no key to delete.

## Template content

SMTP stores no templates, so there is no template content to read from the provider. The content of each site is in the app's code, or in its template files, such as Handlebars views or `email-templates` folders. Read those in the repository.

A template the provider renders because a header names it stays with its site, so its content needs no check.

## Suppression list

Whether there is a list depends on the provider behind the host.

**Providers that keep one.** Sending services keep a list of addresses that hard-bounced or complained, and skip them on every send: SendGrid, Mailgun, Postmark, Resend, Brevo, Mailjet, SparkPost, Mandrill, and Amazon SES. Ask the person to export it from the provider's dashboard as a CSV file, and to tell you where they saved each file. Read the header row to find the address column and the column that says why each address is on the list. Don't read it from the provider's API: this skill has no key for it.

**Providers that keep none.** Gmail, Google Workspace, Microsoft 365, Zoho Mail, and other mailbox providers, and a server the person runs, keep no list to export. Record the list as empty: `- [x] suppressions — empty list: <provider> keeps no suppression list`. When the app keeps its own list of bounced addresses, such as a column it sets from bounce mail, that list stays in the app and its sends keep checking it.

**Map each entry.**

| Entry on the provider's list | PostHog source | Reason |
|---|---|---|
| Hard bounce, permanent failure, invalid or unknown address | bounce | `Imported from <Provider>: bounce` |
| Spam complaint or spam report | complaint | `Imported from <Provider>: spam complaint` |
| An address the person added by hand | manual | `Imported from <Provider>: manual` |

`<Provider>` is the provider behind the host, such as `Imported from Mailgun: bounce`. When the export doesn't say why an address is on the list, ask the person which kind the file holds.

**Leave out the other entries.**

- **Soft bounces, deferrals, and blocks** are temporary refusals by a receiving server. The provider retries those addresses, and so does PostHog.
- **Unsubscribes** are marketing preferences, and PostHog's opt-outs apply to marketing messages only. Some providers also stopped transactional mail to them. Once the sends move, these addresses get transactional email again. Count them, as "For the report" says.

## For the report

- The number of unsubscribes in the export that the import left out, as "Leave out the other entries" says. Write the count, never an address.
