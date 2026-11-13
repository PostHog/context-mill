# Amazon SES account

What the migration needs from the person's Amazon SES account. The agent never changes the account: it reads what the person exports or allows.

Amazon SES keeps identities, templates, and the suppression list per AWS Region. Ask the person which Regions the app sends from: the client's Region setting names one, or the environment the app runs with, `AWS_REGION`, or `AWS_DEFAULT_REGION` for boto3. Read each of them. Each Region answers on its own host, `email.<region>.amazonaws.com`, so every command in this file sets `--region` to the Region it reads. `sdk-reference.md` names the setting each SDK picks the Region with. When the client also sets an endpoint, add `--endpoint-url` with that same URL to every command, so it reads the account the app sends with.

The Regions belong to an AWS account, and each account keeps its own. Ask the person which deployments run the code, such as staging and production, which of them send into the PostHog project being migrated, and which AWS account and Regions each one's Amazon SES client sends with, by its account ID, per site when sites send with different credentials. Read each account only in the Regions its deployments send in. That is the account of the credentials the client is built with, or of the role it assumes, such as with `fromTemporaryCredentials` or `AssumeRole`, not the person's default CLI profile. The person reads it by running `aws sts get-caller-identity --query Account` where each deployment runs or with the role it assumes, or from that role's ARN. Check the IDs against the accounts the repository shows, such as the assumed role's ARN, a `TemplateArn`, or each deployment's account in Terraform or CDK config. Leave out an identity ARN for sending authorization, which names the identity's owner. When the IDs still differ after one more ask, or the person can't say which account a deployment uses, stop before reading and tell the person why.

The moved code runs in every deployment, so a site counts once per deployment, with that deployment's account and Region, in every check `mapping.md` makes other than "Suppressions", such as its templates and configuration sets: it moves only when it would move in each. When the person can't give credentials to read a deployment's account, the sites it runs stay, the run goes on, and the reason is `its AWS account in <deployment> not checked`. When that leaves no site to move, stop and tell the person why. Under "Suppressions", each deployment that sends into the migrated project is its own moved site, and the import takes only their lists. The others go in the report, as "For the report" says.

Read each account's Regions on their own. Before an account's reads, run `aws sts get-caller-identity --query Account`, which needs no permission, with the same credentials and without `--endpoint-url`, since it asks AWS STS, not Amazon SES, or ask the person to run it with theirs, and check that it prints that account's ID. When it prints another, stop and ask the person for that account's credentials: another account's list holds addresses Amazon SES never checked these sends against.

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

When the person chooses that you run them, ask them to create an IAM user whose policy allows only `ses:GetEmailTemplate`, `ses:GetTemplate`, `ses:GetEmailIdentity`, `ses:GetConfigurationSet`, `ses:GetConfigurationSetEventDestinations`, `ses:GetAccount`, `ses:GetIdentityNotificationAttributes`, and `ses:ListSuppressedDestinations`, and an access key for it. Ask them to store its key ID in `SES_READ_ACCESS_KEY_ID` and its secret in `SES_READ_SECRET_ACCESS_KEY` in the git-ignored env file. Run the commands with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set from those two variables for that command only, `AWS_SESSION_TOKEN` and `AWS_SECURITY_TOKEN` unset for it, and `--region` set. The AWS CLI reads a session token from either of those next to the key pair, and AWS refuses a key sent with another key's token. The key reaches only the account it was made in: for each other account, the person runs the commands with their own credentials. Its last use is the suppression import in Step 5. Deleting it, when Step 5 asks, means deleting the access key and the IAM user in AWS and removing both variables from the env file. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template moves needs the template's content: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content: the subject, the HTML, and the text, each as a string. A site that sends an inline template has its content in the code: read it there.

A template belongs to one account and Region. Read each one with its site's account's credentials, in the Region its site sends in, or, for a site that names a `TemplateArn`, in the Region the ARN names.

**Read with the AWS CLI (preferred).** Ask the person to run, for a v2 site:

```bash
aws sesv2 get-email-template --template-name <name> --region <region> > <file outside the repo>
```

The answer holds `TemplateName` and `TemplateContent`, which is `{ Subject, Html, Text }`. A site that sends with the v1 API (`SendTemplatedEmail`) uses:

```bash
aws ses get-template --template-name <name> --region <region> > <file outside the repo>
```

The answer holds `Template`, which is `{ TemplateName, SubjectPart, HtmlPart, TextPart }`.

Each part is a JSON string: read it decoded, so `\n` is a line break and `\"` a quote. A part the template doesn't have is missing from the answer.

Ask the person where they saved each file.

**Read from the API.** With the key above, run the same command yourself and keep the answer only in the temporary file Step 3 writes, which Step 7 deletes once it has brought the email into the code. The key is deleted at the end of Step 5, so when Step 7 finds that file gone, ask the person to run the AWS CLI command above for that template and tell you where they saved it.

Read the person's copies where they saved them. Never write the content into the plan or the report.

## Configuration sets

A configuration set decides, with the account's VDM settings, whether Amazon SES tracks opens and clicks, and it decides where a send's events go and which suppression reasons apply. The reads below are how to tell whether a site's emails had an open pixel, for Step 3's "Opens the provider didn't track", as `mapping.md` says under "Open and click tracking". `mapping.md` needs the sets the sites use: each set a site names in `ConfigurationSetName`, and the default set of each identity the sites send from.

**Read with the AWS CLI (preferred).** Ask the person to run, in each Region, for each domain or address the sites send from:

```bash
aws sesv2 get-email-identity --email-identity <domain> --region <region> --query ConfigurationSetName
```

The answer is the identity's default configuration set, or `null` when it has none. Then, for each set the sites name and each default set:

```bash
aws sesv2 get-configuration-set-event-destinations --configuration-set-name <name> --region <region>
aws sesv2 get-configuration-set --configuration-set-name <name> --region <region> --query '{Suppression: SuppressionOptions, Vdm: VdmOptions, Delivery: DeliveryOptions}'
```

The first answer holds `EventDestinations`, each with `Enabled` and `MatchingEventTypes`: a set tracks opens when an enabled destination lists `OPEN`, and clicks when one lists `CLICK`. In the second, `Suppression` is the set's own suppression settings, or `null` when it uses the account's, and `{}` or an empty `SuppressedReasons` when the set turns suppression off. A `SuppressionScope` without `SuppressedReasons` overrides only where the addresses are kept, not the reasons. `Delivery.TlsPolicy` is `REQUIRE` when the set delivers only over TLS, and `Delivery.MaxDeliverySeconds`, when below 50400, is how soon it gives up delivery: either keeps its sites, as `mapping.md` says. `Vdm` is the set's own VDM settings, or `null` when it uses the account's. Its `DashboardOptions.EngagementMetrics`, when set, turns VDM engagement tracking on or off for the set's sends.

Then read the account's VDM settings, in each Region:

```bash
aws sesv2 get-account --region <region> --query VdmAttributes
```

The answer holds `VdmEnabled` and `DashboardAttributes.EngagementMetrics`, or is `null` when the account never turned VDM on. VDM engagement tracking tracks the opens and clicks of every send whose set doesn't override it, and of every send with no set. Ask the person to paste the answers, or where they saved them.

Then read where each identity sends its SNS notifications, in each Region, since `get-email-identity` doesn't return them:

```bash
aws ses get-identity-notification-attributes --identities <domain> --region <region>
```

The answer's `BounceTopic`, `ComplaintTopic`, and `DeliveryTopic` name the SNS topics that get the identity's bounces, complaints, and deliveries, and a topic left out sends none. A handler subscribed to one of them gets the events of every send from that identity, as `mapping.md` says under "Webhooks". When this can't be read, a handler of SNS notifications that matches by message id or by a tag counts as fed by every identity the sites send from.

**Read from the API.** With the key above, run the same commands yourself.

## Suppression list

Amazon SES keeps an account-level suppression list in each Region, with a reason of `BOUNCE` or `COMPLAINT` for each address. The account's settings name the reasons it suppresses. A configuration set can override them, for the sends that use it, with its own reasons or with none. Amazon SES accepts a send to an address on the list and doesn't send it only when the entry's reason applies to the send: its set's reasons when the set overrides the account's, and the account's otherwise. An entry with another reason is still sent to. An account that never turned the list on has an empty one.

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

**Map each entry.** Work out the reasons that apply to each moved site: the `SuppressedReasons` of its configuration set, the one it names or its identity's default one, when the set's `SuppressionOptions` holds that list, with no reason when the list is empty or `SuppressionOptions` is `{}`. A set that overrides only `SuppressionScope` keeps the account's reasons, and so does a set whose `SuppressionOptions` is `null`. Import the entries whose reason applies to at least one moved site that sends with that list's account in its Region, and skip the rest. Add the lists and reasons an earlier import took, as "An earlier import" says below. PostHog keeps one suppression list per project and checks it on every moved send. A moved site whose own reasons leave out a reason that another moved site imports, or that sends through another account or Region than the list an entry came from, has its sends to those addresses refused where Amazon SES sent them: it moved only with the person's yes, as `mapping.md` says under "Suppressions".

| Amazon SES reason | PostHog source | Reason |
|---|---|---|
| `BOUNCE` | bounce | `Imported from Amazon SES: bounce` |
| `COMPLAINT` | complaint | `Imported from Amazon SES: complaint` |

**An earlier import.** A moved send no longer names its Region or configuration set, so once a run has moved sites, what its import took can't be worked out from the code again. An import takes from one list per AWS account and Region: two accounts' lists in one Region are two lists. Name each by its account ID, read as the top of this file says, and its Region. An earlier run of this app shows as its report, `posthog-migrate-email-amazon-ses-report.md` at the project root, or as a PostHog client with the provider name set to `amazon-ses`, under the name the rewrite file gives, such as `migratedFrom: 'amazon-ses'` in Node.js or `migrated_from="amazon-ses"` in Python. Outside a re-import, also ask the person once whether a migration from Amazon SES, from this app or another, imported into the PostHog project the app sends from beyond what this repository's report records. Take the lists and reasons each earlier import took from its report, under "Suppression list", and ask the person for what no report holds.

- A re-import, as Step 5 says under "Re-import only", always follows a run, and takes exactly the lists and reasons its report records for the project the person confirmed in its step 1: those under "Suppression list" for the migrated project, or those of a deployment that the report names with that other project, reading each with credentials whose account ID matches it, as the top of this file says. When the report is gone or has no "Suppression list" section, ask the person; when they can't say, stop before importing and tell the person why.
- A later run imports the earlier lists and reasons too, alongside its own, and checks the widening both ways, as `mapping.md` says under "Suppressions": PostHog's list already holds the earlier entries, and the sites the earlier runs moved get every entry this run adds. When neither a report nor the person can say what an earlier import took, every site this run moves counts as one whose reasons differ, and everything it imports counts as widening the list for the earlier sites.

**Leave out the other lists.**

- **The global suppression list** is kept by Amazon SES itself, not by the account, so there is nothing of the person's to import.
- **Contact list unsubscribes** apply only to sends with `ListManagementOptions`, and those sites stay on Amazon SES.

## For the report

Each list the import took, this run's and every earlier one's, by AWS account ID and Region, with the reasons that applied to a moved site sending there, whether or not the list held entries for them, so a later run or re-import takes the same.

When the person agreed that this run's import adds a list or a reason for the sites earlier runs moved: those sites, by file and line, and the lists and reasons added. PostHog now refuses their sends to those addresses where Amazon SES sent them.

Each deployment that runs the moved code but sends into another PostHog project: that project, its account ID, and the Regions and reasons that applied to its sites, worked out as "Map each entry" does. Its list was not imported, so the person runs "Re-import only" for that project before the code deploys there, and weekly while any site stays on Amazon SES.

Each site whose note says `suppressions widened: the person agreed`: PostHog now refuses its sends to the addresses the import took from another account's or Region's list, or for a reason its configuration set doesn't suppress, where Amazon SES sent them.
