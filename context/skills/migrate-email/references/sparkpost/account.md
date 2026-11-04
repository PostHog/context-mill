# SparkPost account

What the migration needs from the person's SparkPost account. The agent never changes the account: it reads what the person exports or allows.

An account lives in one region: `app.sparkpost.com` with `api.sparkpost.com`, or `app.eu.sparkpost.com` with `api.eu.sparkpost.com`. Use the API host of the region the app sends from, as `sdk-reference.md` shows.

## DNS records

A domain set up at SparkPost carries these records. Keep all of them until the cutover is done. The SparkPost app shows the exact names and values under Domains, then the domain.

| Record | Name | What it does |
|---|---|---|
| `TXT` (DKIM) | `<selector>._domainkey`, with a selector SparkPost makes, such as `scph0820` | Signs SparkPost's mail |
| `CNAME` | The bounce domain: a subdomain such as `bounce`, or the sending domain itself, pointing to `sparkpostmail.com` (`eu.sparkpostmail.com` in the EU) | Return path for SparkPost's bounces, and its SPF alignment |
| `CNAME` | A subdomain pointing to `spgo.io`, `v2.spgo.io`, `eu.spgo.io`, or `eu.v2.spgo.io` | A custom tracking domain, only when it is set up |
| `TXT` (DMARC) | `_dmarc` | Optional, shared by every provider on the domain |

- An Enterprise account points its bounce CNAME at `<tenant>.mail.e.sparkpost.com` and its tracking CNAME at `<tenant>.et.e.sparkpost.com`, and can verify a domain with `MX` records.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog a label SparkPost uses for its bounce or tracking domain.
- PostHog's DKIM records have their own names, so they sit next to SparkPost's `_domainkey` record.
- When the sending domain itself is SparkPost's bounce domain, it holds a `CNAME`, and DNS allows no other record on that name. A PostHog record for that exact name, such as an SPF `TXT` record, cannot be added. Tell the person: they can move SparkPost's bounce domain to a subdomain such as `bounce` first, in SparkPost and in DNS, or send from PostHog on another domain. Record the domain as not verified until then.
- Keep the one `_dmarc` record. Never add a second one.
- A domain whose `v=spf1` record names SparkPost keeps it. Merge PostHog's include into that record.

## Read-only key

The app's own SparkPost key usually has only the permissions to send, and it can't read templates or suppressions. When the person chooses the API over the dashboard, ask them to create an API key in SparkPost (Configuration, then API Keys) with only the permissions to read templates and the suppression list, store it in `SPARKPOST_READ_API_KEY` in the git-ignored env file, and note in the plan that the run created it. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in SparkPost and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Template content

A site whose template the person moves to PostHog needs the content of its published version, to check it before they make the PostHog template.

**Copy from the dashboard.** In SparkPost: Content, then Templates, then the template, then its published version. Ask the person for the template's id, its subject, its from address, its reply-to address when it has one, its HTML, and its plain text when it has one.

**Read from the API.** For an EU account, whose app sends through `api.eu.sparkpost.com`, use that host in every request of this file instead of `api.sparkpost.com`.

`GET https://api.sparkpost.com/api/v1/templates/{template_id}?draft=false` with `Authorization: $SPARKPOST_READ_API_KEY`, the key alone with no `Bearer`. The answer holds `results.id`, `results.published`, `results.options`, and `results.content`, with `subject`, `from`, `reply_to`, `html`, `text`, `amp_html`, and `headers`. A template the site sends with `use_draft_template: true` stays, so its draft needs no read.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which Step 3 deletes once the site is classified. Never write the content into the plan or the report.

## Suppression list

SparkPost keeps one suppression list per account, and one per subaccount. Each entry has a `recipient`, a `type` (`transactional`, `non_transactional`, or `open_tracking`), a `source`, and a `description`, and some carry a `list_id` for one mailing list. SparkPost skips an address with a `transactional` entry on transactional sends, and one with a `non_transactional` entry on the others. It also keeps a global suppression list that no API can read.

**Export from the dashboard.** In SparkPost: Recipients, then Suppressions. SparkPost's docs describe no file export there, so ask the person whether they already have an export file, such as from their own tooling, and where they saved it. Read the header row to find the address, type, and source columns. Without a file, read the list from the API.

**Read from the API.** With `Authorization: $SPARKPOST_READ_API_KEY`, on `api.eu.sparkpost.com` for an EU account:

```
GET https://api.sparkpost.com/api/v1/suppression-list?cursor=initial&per_page=10000&sources=Bounce%20Rule,Spam%20Complaint,Manually%20Added,Compliance
```

The answer holds `results`, a list of `{ recipient, type, source, description, list_id, created, updated }`, `total_count`, and `links`. Follow the `href` of the link whose `rel` is `next` until no such link comes back or `results` is empty. Wait 1 to 5 seconds and retry on `429`. An account with subaccounts: the search covers the primary account and every subaccount unless an `X-MSYS-SUBACCOUNT` header names one, and `subaccount_id` shows where an entry came from. Ask the person which accounts the app sends from, and take only those entries.

**Map each entry.**

| SparkPost `source` | Entries to take | PostHog source | Reason |
|---|---|---|---|
| `Bounce Rule` | Every type | bounce | `Imported from SparkPost: bounce` |
| `Spam Complaint` | Every type | complaint | `Imported from SparkPost: spam complaint` |
| `Manually Added` | `transactional` only | manual | `Imported from SparkPost: added manually` |
| `Compliance` | `transactional` only | manual | `Imported from SparkPost: compliance` |

An address can come back once per type. Repeating it in the import is safe.

**Leave out the other entries.**

- **`List Unsubscribe` and `Unsubscribe Link`** are unsubscribes from non-transactional mail, and so are `Manually Added` and `Compliance` entries of type `non_transactional`, and entries with a `list_id`. They are marketing preferences, and PostHog's opt-outs apply to marketing messages only. SparkPost skipped these addresses on any send that was not marked `transactional: true`, and sends that move send as transactional. Count them, and tell the person the count in the report.
- **`Tracking Consent Revoked`** entries, of type `open_tracking`, block no send: they only turn off open tracking for the address. Count them for the report.