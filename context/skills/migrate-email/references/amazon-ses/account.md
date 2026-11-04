# Amazon SES account

What the migration needs from the person's Amazon SES account. The agent never changes the account: it reads what the person exports or allows.

Amazon SES keeps identities, templates, and the suppression list per AWS Region. Ask the person which Regions the app sends from: the client's `region`, or `AWS_REGION`, names one. Read each of them. Each Region answers on its own host, `email.<region>.amazonaws.com`, so every command in this file sets `--region` to the Region it reads. `sdk-reference.md` names the setting each SDK picks the Region with. When the client also sets an endpoint, add `--endpoint-url` with that same URL to every command, so it reads the account the app sends with.

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

The app's AWS credentials, or the role it runs with, often reach other AWS services, and may not be allowed to read templates, configuration sets, or the suppression list. Ask the person to run the AWS CLI commands below with their own credentials and save the output, which needs no key from them.

When the person chooses that you run them, ask them to create an IAM user whose policy allows only `ses:GetEmailTemplate`, `ses:GetTemplate`, `ses:GetEmailIdentity`, `ses:GetConfigurationSet`, `ses:GetConfigurationSetEventDestinations`, `ses:GetAccount`, and `ses:ListSuppressedDestinations`, and an access key for it. Ask them to store its key ID in `SES_READ_ACCESS_KEY_ID` and its secret in `SES_READ_SECRET_ACCESS_KEY` in the git-ignored env file, and note in the plan that the run created it. Run the commands with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set from those two variables for that command only, `AWS_SESSION_TOKEN` and `AWS_SECURITY_TOKEN` unset for it, and `--region` set. The AWS CLI reads a session token from either of those next to the key pair, and AWS refuses a key sent with another key's token. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the access key and the IAM user in AWS and remove the two variables from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

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

## Configuration sets

A configuration set decides whether Amazon SES tracks opens and clicks, where a send's events go, and which suppression reasons apply. `mapping.md` needs the sets the sites use: each set a site names in `ConfigurationSetName`, and the default set of each identity the sites send from.

**Read with the AWS CLI (preferred).** Ask the person to run, in each Region, for each domain or address the sites send from:

```bash
aws sesv2 get-email-identity --email-identity <domain> --region <region> --query ConfigurationSetName
```

The answer is the identity's default configuration set, or `null` when it has none. Then, for each set the sites name and each default set:

```bash
aws sesv2 get-configuration-set-event-destinations --configuration-set-name <name> --region <region>
aws sesv2 get-configuration-set --configuration-set-name <name> --region <region> --query SuppressionOptions
```

The first answer holds `EventDestinations`, each with `Enabled` and `MatchingEventTypes`: a set tracks opens when an enabled destination lists `OPEN`, and clicks when one lists `CLICK`. The second answer is the set's own suppression settings, or `null` when it uses the account's. Ask the person to paste the answers, or where they saved them.

**Read from the API.** With the key above, run the same commands yourself.

## Suppression list

Amazon SES keeps an account-level suppression list in each Region, with a reason of `BOUNCE` or `COMPLAINT` for each address. The account's settings name the reasons it suppresses. Amazon SES accepts a send to an address on the list and doesn't send it only when the entry's reason is one of those. An entry with another reason is still sent to. A configuration set can override the account's reasons with its own, or with none. An account that never turned the list on has an empty one.

Read the account's reasons first, in each Region:

```bash
aws sesv2 get-account --region <region> --query SuppressionAttributes.SuppressedReasons
```

**Read with the AWS CLI (preferred).** Ask the person to run, for each Region:

```bash
aws sesv2 list-suppressed-destinations --region <region> --output json > <file outside the repo>
```

The answer holds `SuppressedDestinationSummaries`, a list of `{ EmailAddress, Reason, LastUpdateTime }`, and `NextToken` when more entries follow. The CLI doesn't fetch the next page itself: while the answer has a `NextToken`, ask them to run the command again with `--next-token <token>` into a new file. Wait and retry on `TooManyRequestsException`. Ask the person where they saved each file.

**Read from the API.** With the key above, run the same commands yourself, page by page.

**Map each entry.** Import only the entries whose reason the account suppresses, and skip the rest. When a set a moved site uses has its own `SuppressedReasons` that leave out a reason the account suppresses, PostHog now refuses that site's sends to those addresses where Amazon SES sent them: note it in the site's plan row.

| Amazon SES reason | PostHog source | Reason |
|---|---|---|
| `BOUNCE` | bounce | `Imported from Amazon SES: bounce` |
| `COMPLAINT` | complaint | `Imported from Amazon SES: complaint` |

**Leave out the other lists.**

- **The global suppression list** is kept by Amazon SES itself, not by the account, so there is nothing of the person's to import.
- **Contact list unsubscribes** apply only to sends with `ListManagementOptions`, and those sites stay on Amazon SES.
