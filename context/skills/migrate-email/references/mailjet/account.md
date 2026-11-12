# Mailjet account

What the migration needs from the person's Mailjet account. The agent never changes the account: it reads what the person exports or allows.

**US setup.** An account on Mailjet's US setup, whose app sends through `api.us.mailjet.com` or sets its Mailjet client's host to it, as `sdk-reference.md` says, uses that host in every request of this file instead of `api.mailjet.com`: the DNS, template, message, and contact requests alike.

## DNS records

A domain set up at Mailjet carries these records. Keep all of them until the cutover is done. The Mailjet dashboard shows the exact values in the account settings, under the domain's sender setup, and `GET https://api.mailjet.com/v3/REST/dns/{domain}` answers them too.

| Record | Name | What it does |
|---|---|---|
| `TXT` (DKIM) | `mailjet._domainkey` | Signs Mailjet's mail |
| `TXT` (SPF) | the domain itself, `include:spf.mailjet.com` | Allows Mailjet's servers to send for the domain |
| `TXT` | `mailjet._<token>`, such as `mailjet._123a4bc56` | Proves to Mailjet that the person owns the domain |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- Mailjet sends with its own bounce address, so it puts no MAIL FROM record on the domain. PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label that starts with `mailjet`.
- PostHog's DKIM records have their own names, so they sit next to `mailjet._domainkey`.
- Keep the one `_dmarc` record. Never add a second one.
- A domain has one SPF record. When it names `include:spf.mailjet.com`, keep that include and merge PostHog's include into the same record.

## Read-only key

Mailjet has no read-only or restricted key. Every API key pair reaches all the data of its own account: the primary key reads the primary account, and a subaccount key reads only its subaccount. Templates and sent messages belong to the key that made them, so a new key cannot read them. When the person chooses the API over the dashboard, use the pair the app already sends with, from its existing env variables, such as `MJ_APIKEY_PUBLIC` and `MJ_APIKEY_PRIVATE`. When the sites use several pairs, read with each pair the data of its own sites.

That pair reads the templates and the suppression data, so this run creates no provider key. Never print the keys, and never write them into another file. Pass them to `curl --user "$MJ_APIKEY_PUBLIC:$MJ_APIKEY_PRIVATE"` from the environment.

## Template content

A site whose template moves needs the template's content: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content, with the template language as it is written. A site with `TemplateLanguage: true` and its own content needs none of this: its content is in the code.

**Copy from the dashboard.** In the Mailjet dashboard, open the template. Ask the person for the template's number, its subject, its sender and reply-to address, any other header it sets, its HTML, and its plain text when it has one. For a template built in the drag-and-drop or MJML editor, ask for the HTML it exports, not the editor's source.

**Read from the API.** `GET https://api.mailjet.com/v3/REST/template/{template_id}/detailcontent` with Basic auth from the pair above. The answer holds `Data`, a list with one entry of `{ "Html-part", "Text-part", "MJMLContent", Headers }`, and `Headers` holds `From`, `Subject`, `Reply-to`, and any other header the template sets. Use `Html-part`, not `MJMLContent`: Mailjet renders the HTML part from the MJML. A v3 site can pass the template's name in `Mj-TemplateID` instead of its number: `GET https://api.mailjet.com/v3/REST/template?Name={name}` answers its `ID`. When the API answers no template for the number the site sends, ask the person for the dashboard copy.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

## Suppression list

Mailjet blocks some addresses on every later send, such as after a bounce that its `bounce` event marks with `blocked: true`. A send to a blocked address gets a `blocked` event with the error `preblocked`. Mailjet has no single suppression list that one API call returns. What exists:

**An export from the dashboard.** Ask the person whether they have a CSV of the addresses Mailjet blocked, hard-bounced, or that marked an email as spam. Ask where they saved each file, and which of the three kinds it holds. Read the header row to find the address column.

**Read from the API.** With Basic auth from the pair above:

- Hard bounces: `GET https://api.mailjet.com/v3/REST/message?MessageStatus=10&ShowContactAlt=true`. Each entry of `Data` holds the recipient's address in `ContactAlt`.
- Spam reports: `GET https://api.mailjet.com/v3/REST/message?MessageStatus=6&ShowContactAlt=true`, and `GET https://api.mailjet.com/v3/REST/contact`, whose entries with `IsSpamComplaining: true` hold the address in `Email`.

Page each with `Limit=1000` and `Offset`, adding 1000 each time, until a page has fewer than 1000 entries. Wait and retry on `429`. The message list reaches only the messages Mailjet still keeps, as "For the report" says. An address can show up more than once: import it once, with the first source in the table below.

**Map each entry.**

| Mailjet | PostHog source | Reason |
|---|---|---|
| Spam reports, and contacts with `IsSpamComplaining` | complaint | `Imported from Mailjet: spam report` |
| Hard bounces | bounce | `Imported from Mailjet: hard bounce` |
| Blocked addresses in an export, when the person can't tell why | manual | `Imported from Mailjet: blocked` |

**Leave out the other lists.**

- **Soft bounces** (`MessageStatus=9`) are temporary refusals by a receiving server, not a sign that the address is bad.
- **The campaign exclusion list** (`IsExcludedFromCampaigns`) blocks marketing campaigns only: Mailjet still sends Send API email to those addresses, and so will PostHog.
- **Unsubscribes** from contact lists are marketing preferences, and PostHog's opt-outs apply to marketing messages only.

## For the report

- When the import read hard bounces from the message list: it reaches only the messages Mailjet still keeps, so older bounces may be missing.
- The number of contact-list unsubscribes the import left out. Ask the person for it, such as from their contact-list exports, and leave it out when they don't have it.

## Tracking settings

The account's tracking settings decide how Mailjet tracks the opens and clicks of every send, and they cap what a send's own `TrackOpens` and `TrackClicks` ask for. They cover every API key of the account, and Mailjet's API has no call that reads them. Ask the person once for each account the sites send from:

- The open tracking and the click tracking setting, each `Enabled`, `Disabled`, or `Anonymous`, in the Mailjet dashboard under Account, then Tracking.
- Whether any contact refused open or click tracking. Mailjet keeps each as a contact property, "Open tracking consent" and "Click tracking consent": an export of all contacts shows them as `mjoptinopen` and `mjoptinclick`, where `0` means the contact opted out. Ask for the export of all contacts, not one list: transactional recipients often sit in no list. An answer read from one list counts as not given, and so does an export without the `mjoptinopen` or `mjoptinclick` column, unless the person confirms the account never collected tracking preferences.

`mapping.md` says under "Tracking" how each answer decides the site. When the person can't tell the open tracking setting, or whether a contact opted out of open tracking, the sites of that account stay, and the reason is `account tracking not checked`. A missing click answer matters only for a site that moves to a template made in PostHog, as `mapping.md` says. Note the answers in the plan.
