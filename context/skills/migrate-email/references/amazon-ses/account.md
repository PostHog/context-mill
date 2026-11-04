# Amazon SES account

What the migration needs from the person's Amazon SES account. The agent never changes the account: it reads what the person exports or allows.

Amazon SES keeps identities, templates, and the suppression list per AWS Region. Ask the person which Regions the app sends from: the client's `region`, or `AWS_REGION`, names one. Read each of them.

## DNS records

A domain verified at Amazon SES carries these records. Keep all of them until the cutover is done. The Amazon SES console shows the exact names under Identities, then the domain, for each Region.

| Record | Name | What it does |
|---|---|---|
| `CNAME` (DKIM), three of them | `<token>._domainkey`, each pointing to `<token>.dkim.<region>.amazonses.com` or a similar name | Easy DKIM: signs Amazon SES's mail |
| `MX` | The custom MAIL FROM subdomain, such as `bounce` | Only when a custom MAIL FROM domain is set up: takes Amazon SES's bounces |
| `TXT` (SPF) | The custom MAIL FROM subdomain | Only when a custom MAIL FROM domain is set up: `v=spf1 include:amazonses.com ~all` |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- A domain set up with its own DKIM key (Bring Your Own DKIM) has one `TXT` record at `<selector>._domainkey` in place of the three CNAMEs.
- A domain verified in more than one Region has a set of DKIM records for each.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog the subdomain Amazon SES uses as its custom MAIL FROM.
- PostHog's DKIM records have their own names, so they sit next to the Amazon SES `_domainkey` records.
- Keep the one `_dmarc` record. Never add a second one.
- Never add a second `v=spf1` record on one name. A name whose SPF record names `include:amazonses.com` keeps it: merge PostHog's include into that record.

## Read-only key

The app's AWS credentials, or the role it runs with, often reach other AWS services, and may not be allowed to read templates or the suppression list. Ask the person to run the AWS CLI commands below with their own credentials and save the output, which needs no key from them.

When the person chooses that you run them, ask them to create an IAM user whose policy allows only `ses:GetEmailTemplate`, `ses:GetTemplate`, and `ses:ListSuppressedDestinations`, and an access key for it. Ask them to store its key ID in `SES_READ_ACCESS_KEY_ID` and its secret in `SES_READ_SECRET_ACCESS_KEY` in the git-ignored env file, and note in the plan that the run created it. Run the commands with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set from those two variables for that command only, and `--region` set. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the access key and the IAM user in AWS and remove the two variables from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template the person moves to PostHog needs the template's content, to check it before they make the PostHog template. A site that sends an inline template has its content in the code: read it there.

**Read with the AWS CLI (preferred).** Ask the person to run, for a v2 site:

```bash
aws sesv2 get-email-template --template-name <name> --region <region> > <file outside the repo>
```

The answer holds `TemplateName` and `TemplateContent`, which is `{ Subject, Html, Text }`. A site that sends with the v1 API (`SendTemplatedEmail`) uses:

```bash
aws ses get-template --template-name <name> --region <region> > <file outside the repo>
```

The answer holds `Template`, which is `{ TemplateName, SubjectPart, HtmlPart, TextPart }`.

Ask the person where they saved each file.

**Read from the API.** With the key above, run the same command yourself and keep the answer only in the temporary file Step 3 writes, which Step 3 deletes once the site is classified.

Read the person's copies where they saved them. Never write the content into the plan or the report.

## Suppression list

Amazon SES keeps an account-level suppression list in each Region, with a reason of `BOUNCE` or `COMPLAINT` for each address. It accepts a send to an address on the list and doesn't send it. An account that never turned the list on has an empty one.

**Read with the AWS CLI (preferred).** Ask the person to run, for each Region:

```bash
aws sesv2 list-suppressed-destinations --region <region> --output json > <file outside the repo>
```

The answer holds `SuppressedDestinationSummaries`, a list of `{ EmailAddress, Reason, LastUpdateTime }`, and `NextToken` when more entries follow. The CLI doesn't fetch the next page itself: while the answer has a `NextToken`, ask them to run the command again with `--next-token <token>` into a new file. Wait and retry on `TooManyRequestsException`. Ask the person where they saved each file.

**Read from the API.** With the key above, run the same commands yourself, page by page.

**Map each entry.**

| Amazon SES reason | PostHog source | Reason |
|---|---|---|
| `BOUNCE` | bounce | `Imported from Amazon SES: bounce` |
| `COMPLAINT` | complaint | `Imported from Amazon SES: complaint` |

**Leave out the other lists.**

- **The global suppression list** is kept by Amazon SES itself, not by the account, so there is nothing of the person's to import.
- **Contact list unsubscribes** apply only to sends with `ListManagementOptions`, and those sites stay on Amazon SES.
