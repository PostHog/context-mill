# Mailgun account

What the migration needs from the person's Mailgun account. The agent never changes the account: it reads what the person exports or allows.

**Regions.** Mailgun's regions are separate, and every read goes to the region of the sending domain: `api.mailgun.net` for the US, `api.eu.mailgun.net` for the EU. An app in the EU region names `api.eu.mailgun.net` in its client, its Rails `mailgun_settings`, or `mailgun.APIBaseEU` in Go, as `sdk-reference.md` says under "EU region". For such an app, use `https://api.eu.mailgun.net` in every request of this file. Each request below names both hosts.

## DNS records

A sending domain verified at Mailgun, often a subdomain such as `mg.example.com`, carries these records. Keep all of them until the cutover is done. The Mailgun dashboard shows the exact names and values in the domain's DNS records, under Send, then Sending, then Domains.

| Record | Name | What it does |
|---|---|---|
| `TXT` (SPF) | the sending domain itself | `v=spf1 include:mailgun.org ~all`: lets Mailgun send for the domain |
| `TXT` (DKIM) | `<selector>._domainkey`, such as `mx._domainkey`, `smtp._domainkey`, or a selector the person chose | Signs Mailgun's mail |
| `CNAME` (DKIM) | `pdk1._domainkey` and `pdk2._domainkey` | Signs Mailgun's mail, in place of the `TXT` record, when Automatic Sender Security is on |
| `CNAME` | `email`, or the domain's own tracking prefix | Open, click, and unsubscribe tracking. Points to `mailgun.org`, or `eu.mailgun.org` in the EU region |
| `MX` | the sending domain itself | `mxa.mailgun.org` and `mxb.mailgun.org` (`mxa.eu.mailgun.org` and `mxb.eu.mailgun.org` in the EU): lets Mailgun receive mail for the domain, such as for its routes |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label Mailgun uses, such as the tracking prefix `email`.
- PostHog's DKIM records have their own names, so they sit next to Mailgun's `_domainkey` records.
- Keep the one `_dmarc` record. Never add a second one.
- The domain's SPF record names `include:mailgun.org`. Keep it, and merge PostHog's include into that record.
- Keep Mailgun's `MX` records: removing them stops the mail that Mailgun receives for the domain.

## Read-only key

The app's own Mailgun key is often a domain sending key, which can only send, and it can't read templates or suppressions. When the person chooses the API over the dashboard, ask them to create an API key in Mailgun (Settings, then API Security) with the role that has the fewest rights and still reads templates and suppressions, and a short expiry when the form offers one. Ask them to store it in `MAILGUN_READ_API_KEY` in the git-ignored env file, and note in the plan that the run created it. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in Mailgun and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template the person moves to PostHog needs the content of the version it sends: the active version, or the one the site names with `t:version`.

**Copy from the dashboard.** In the Mailgun dashboard, open the template and the version the site sends. Ask the person for the template's name, the version's engine, its HTML content, and its `From`, `Reply-To`, and `Subject` headers when the version sets them.

**Read from the API.** With the user `api` and the password `$MAILGUN_READ_API_KEY`:

- `GET https://api.mailgun.net/v3/<domain>/templates/<name>?active=yes`, or `https://api.eu.mailgun.net` for an EU domain, reads a template of the sending domain with its active version.
- `GET https://api.mailgun.net/v3/<domain>/templates/<name>/versions/<tag>`, or `https://api.eu.mailgun.net` for an EU domain, reads the version a site names with `t:version`.
- When the domain has no template of that name, `GET https://api.mailgun.net/v4/templates/<name>?active=yes`, or `https://api.eu.mailgun.net` for an account in the EU region, reads an account template with its active version.
- `GET https://api.mailgun.net/v4/templates/<name>/versions/<tag>`, or `https://api.eu.mailgun.net` for an account in the EU region, reads the account template's version a site names with `t:version`.

The answer holds `template`, with `name`, `id`, and `version`: `{ tag, template, engine, headers, active }`. `version.template` is the content, and `version.headers` can hold `From`, `Subject`, and `Reply-To`.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which Step 3 deletes once the site is classified. Never write the content into the plan or the report.

## Tracking settings

A site that sets no open or click tracking field sends with its domain's setting, as `mapping.md` says under "Tracking".

**Ask the person.** In the Mailgun dashboard, the sending domain's settings show whether open tracking and click tracking are on, and whether click tracking is HTML only.

**Read from the API.** `GET https://api.mailgun.net/v3/domains/<domain>/tracking`, or `https://api.eu.mailgun.net` for an EU domain, with the user `api` and the password `$MAILGUN_READ_API_KEY`. The answer holds `tracking.open.active` and `tracking.click.active`.

## Suppression list

Mailgun keeps suppression lists per sending domain. It drops a send to an address on any of them, transactional mail included. Its bounce list holds permanent failures only, such as a mailbox that doesn't exist. Take the lists of every domain the app sends from.

**Export from the dashboard (preferred).** In the Mailgun dashboard, the Suppressions tab of each sending domain lists Bounces, Complaints, and Unsubscribes. Ask the person to download each of them where the dashboard offers it, and to tell you where they saved each file. Read the header row to find the address column. When the dashboard offers no download, use the API.

**Read from the API.** With the user `api` and the password `$MAILGUN_READ_API_KEY`:

- `GET https://api.mailgun.net/v3/<domain>/bounces?limit=1000`, or `https://api.eu.mailgun.net` for an EU domain
- `GET https://api.mailgun.net/v3/<domain>/complaints?limit=1000`, or `https://api.eu.mailgun.net` for an EU domain

Each answers `{ items, paging }`. A bounce is `{ address, code, error, created_at }`, and a complaint `{ address, created_at }`. Read the next page from the URL in `paging.next`, until a page has no items. Wait and retry on `429`.

**Map each entry.**

| Mailgun list | PostHog source | Reason |
|---|---|---|
| Bounces | bounce | `Imported from Mailgun: bounce` |
| Complaints | complaint | `Imported from Mailgun: spam complaint` |

**Leave out the other lists.**

- **Unsubscribes** are recipients who clicked a Mailgun unsubscribe link, for the whole domain or for some tags. PostHog's opt-outs apply to marketing messages only. At Mailgun an unsubscribe also stopped transactional mail from that domain, or with that tag. Once the sends move, these addresses get transactional email again. Count them, and tell the person the count in the report. Count the rows of the person's Unsubscribes download, or read `GET https://api.mailgun.net/v3/<domain>/unsubscribes?limit=1000`, or `https://api.eu.mailgun.net` for an EU domain, page by page as above. When neither is given, the report says the count was not checked.
- **Allowlists** are addresses and domains that Mailgun never adds to its bounce list. They are not suppressions.
