# SparkPost account

What the migration needs from the person's SparkPost account. The agent never changes the account: it reads what the person exports or allows.

An account lives in one region: `app.sparkpost.com` with `api.sparkpost.com`, or `app.eu.sparkpost.com` with `api.eu.sparkpost.com`.

**EU accounts.** An app on an EU account names `api.eu.sparkpost.com`, or sets the client's host to it by a setting, as `sdk-reference.md` says under "EU accounts". For such an app, use `api.eu.sparkpost.com` in every request of this file instead of `api.sparkpost.com`.

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

The app's own SparkPost key usually has only the permissions to send, and it can't read templates or suppressions. When the person chooses the API over the dashboard, ask them to create an API key in SparkPost (Configuration, then API Keys) with only the permissions to read the account, subaccounts, templates, and the suppression list, store it in `SPARKPOST_READ_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Its last use is the suppression import in Step 5. At the end of Step 5, on every way out of it, ask the person to delete the key in SparkPost and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

The steps call this key the full-access provider key.

## Tracking settings

A site that sets no open or click tracking, in its recipients' `options`, its own `options`, or its template's, sends with the account's settings, as `mapping.md` says under "Tracking". A subaccount can also turn off open tracking for every send of its own. Every site that tracked opens, including one that sets its own tracking, also needs whether the account or subaccount it sends from minimizes open events: that setting wins over the send's own value.

**Ask the person.** In SparkPost's account settings: whether engagement tracking is on by default for API sends, whether click tracking is turned off, whether open events are minimized, whether sends are transactional by default, and whether a `List-Unsubscribe` header is added to transactional mail. For each subaccount the moved sites send from: whether open tracking is turned off for it, and whether its open events are minimized.

**Read from the API.** `GET https://api.sparkpost.com/api/v1/account` with `Authorization: $SPARKPOST_READ_API_KEY`. The answer holds `results.options` with `rest_tracking_default`, `click_tracking`, `enable_minimized_event_passthrough`, `transactional_default`, and `transactional_unsub`. A missing `rest_tracking_default` means `true`, a missing `click_tracking` turns nothing off, and a missing `enable_minimized_event_passthrough`, `transactional_default`, or `transactional_unsub` means `false`. The account's `enable_minimized_event_passthrough` applies to the primary account's sends, and to a subaccount's sends when the subaccount sets none of its own. A subaccount has no setting of its own for the others. For a subaccount, `GET https://api.sparkpost.com/api/v1/subaccounts/{subaccount_id}` holds `results.options.open_tracking_disabled`, `false` when missing, and `results.options.enable_minimized_event_passthrough`. A subaccount without its own `enable_minimized_event_passthrough` takes the account's, and its own value wins when it sets one.

**Opens.** When neither the site's recipients' or transmission's `options` nor its template's set open tracking, in the order "Tracking" in `mapping.md` gives, the account's `rest_tracking_default` decides whether SparkPost put an open pixel in the site's emails: `false` means they had none. A subaccount with `open_tracking_disabled: true` put none in its sends, whatever they set. When the person can't say how these are set and the API isn't read, nobody can tell whether the site's emails had one, as Step 3 under "Opens the provider didn't track" says.

**Clicks.** When neither the site's recipients' or transmission's `options` nor its template's set click tracking, in the order "Tracking" in `mapping.md` gives, the account's `rest_tracking_default` and `click_tracking` decide whether SparkPost tracked its clicks. When the person can't say how they are set and the API isn't read, nobody knows whether SparkPost tracked the site's clicks, as Step 3 says under "A template in PostHog".

## Template content

A site whose template moves needs the content of the version it sends: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content as SparkPost stores it, in its template language, and so does the dashboard. A site sends the published version, or the draft when it sets `use_draft_template: true`.

**Copy from the dashboard.** In SparkPost: Content, then Templates, then the template, then the version the site sends. Ask the person for the template's id, its subject, its from address, its reply-to address when it has one, its HTML, and its plain text when it has one. Also ask whether the version is stored as a whole raw message (RFC 822), whether it has an AMP part or custom headers, and how its open tracking, click tracking, and transactional settings are set: `mapping.md` keeps a template for its open tracking and transactional settings, and notes its click tracking in the plan row. For each snippet the content renders with `render_snippet`, ask for its id, its HTML, and its text.

**Read from the API.** `GET https://api.sparkpost.com/api/v1/templates/{template_id}?draft=false`, or `?draft=true` for a site that sends the draft, with `Authorization: $SPARKPOST_READ_API_KEY`, the key alone with no `Bearer`. The answer holds `results.id`, `results.published`, `results.options` with `open_tracking`, `click_tracking`, and `transactional`, and `results.content`, with `subject`, `from`, `reply_to`, `html`, `text`, `amp_html`, and `headers`, or `email_rfc822` alone. A snippet reads from `GET https://api.sparkpost.com/api/labs/snippets/{snippet_id}`, whose `results.content` holds `html`, `text`, and `amp_html`. SparkPost's docs don't name the key permission that reads snippets: when the read is refused, ask the person for copies. A site that sends from a subaccount reads its template and snippets with the header `X-MSYS-SUBACCOUNT: <subaccount id>`, as `mapping.md` says under "Subaccounts", and a site of the primary account with `X-MSYS-SUBACCOUNT: 0` when the account has subaccounts: a primary key reads the primary account's templates and snippets when the header is missing. A subaccount's send can also use a template or snippet of the primary account whose `shared_with_subaccounts` is `true`. When the subaccount's read finds none, read it with `X-MSYS-SUBACCOUNT: 0`, and use it only when `results.shared_with_subaccounts` is `true`. Otherwise ask the person for copies.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

## Suppression list

SparkPost keeps one suppression list per account, and one per subaccount. Each entry has a `recipient`, a `type` (`transactional`, `non_transactional`, or `open_tracking`), a `source`, and a `description`, and some carry a `list_id` for one mailing list. SparkPost skips an address with a `transactional` entry on transactional sends, and one with a `non_transactional` entry on the others. It also keeps a global suppression list that no API can read.

**Export from the dashboard.** In SparkPost: Recipients, then Suppressions. SparkPost's docs describe no file export there, so ask the person whether they already have an export file, such as from their own tooling, and where they saved it. Read the header row to find the address, type, and source columns. Without a file, read the list from the API.

**Read from the API.** With `Authorization: $SPARKPOST_READ_API_KEY`, on `api.eu.sparkpost.com` for an EU account (see the top of this file):

```
GET https://api.sparkpost.com/api/v1/suppression-list?cursor=initial&per_page=10000&types=transactional,non_transactional,open_tracking
```

The request takes every source and every type, so the agent can import some entries and count the others. Without `types`, SparkPost leaves out `open_tracking` entries.

The answer holds `results`, a list of `{ recipient, type, source, description, list_id, created, updated }`, `total_count`, and `links`. Follow the `href` of the link whose `rel` is `next` until no such link comes back or `results` is empty. Wait 1 to 5 seconds and retry on `429`. An account with subaccounts: read the list of each account the moved sites send from, as `mapping.md` says under "Subaccounts", on its own, with the header `X-MSYS-SUBACCOUNT: 0` for the primary account and the subaccount's ID for a subaccount. A search without the header covers every list at once, and SparkPost says such a search can be up to 20 minutes out of date. An account without subaccounts needs no header. When the moved sites send from more than one account, count the import as complete only when the list of every one is in.

**Map each entry.**

| SparkPost `source` | Entries to take | PostHog source | Reason |
|---|---|---|---|
| `Bounce Rule` | Every type | bounce | `Imported from SparkPost: bounce` |
| `Spam Complaint` | Every type | complaint | `Imported from SparkPost: spam complaint` |
| `Manually Added` | `transactional` only | manual | `Imported from SparkPost: added manually` |
| `Compliance` | `transactional` only | manual | `Imported from SparkPost: compliance` |

An address can come back once per type. Repeating it in the import is safe.

**Leave out the other entries.**

- **`List Unsubscribe` and `Unsubscribe Link`** are unsubscribes from non-transactional mail, and so are `Manually Added` and `Compliance` entries of type `non_transactional`, and entries with a `list_id`. They are marketing preferences, and PostHog's opt-outs apply to marketing messages only. SparkPost skipped these addresses on every send it sent as non-transactional. A site that SparkPost sent as non-transactional moves only as `mapping.md` says under `options.transactional`, and every send that moves sends as transactional.
- **`Tracking Consent Revoked`** entries, of type `open_tracking`, block no send: they only turn off open tracking for the address. Step 3 asks about them first, as `mapping.md` says under "Tracking".

## For the report

When the list was read, from the API or an export file, count from it:

- the entries left out as unsubscribes from non-transactional mail, as "Leave out the other entries" says;
- the `Tracking Consent Revoked` entries.

When the list wasn't read, write `not counted` for each.
