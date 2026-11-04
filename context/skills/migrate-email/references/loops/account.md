# Loops account

What the migration needs from the person's Loops account. The agent never changes the account: it reads what the person exports or allows.

Every request in this file goes to `app.loops.so`, Loops' one host, even when the app's client points at another URL with `WithBaseURL` or `apiRoot`, as `sdk-reference.md` says.

## DNS records

A sending domain set up at Loops carries these records. Keep all of them until the cutover is done. The Loops dashboard shows the exact names and values under Settings, then Domain, then View records. It can also download them as a zone file, or share them on a public records page.

| Record | Name | What it does |
|---|---|---|
| `TXT` (SPF) | `envelope.<sending domain>` | Loops' SPF, on its own label |
| `MX` | `envelope.<sending domain>` | Takes Loops' bounces for its return path |
| DKIM | the `_domainkey` names Loops shows | Signs Loops' mail |
| `TXT` (DMARC) | `_dmarc` | Loops shows a default one. Shared by every provider on the domain |

- Loops sends from the From name the person sets in each email, on the team's sending domain, such as `hello@mail.example.com`. A Loops team has one sending domain. An app that sends from several domains uses one Loops team, with its own API key, per domain: each domain has its own records.
- PostHog's sender uses its own label for its MAIL FROM, `feedback` by default. Never give PostHog the label `envelope`, which Loops uses.
- Loops' SPF record sits at `envelope.<sending domain>`, not at the sending domain. Leave it alone. When PostHog's SPF record goes to a name that already has a `v=spf1` record, merge PostHog's include into it.
- PostHog's DKIM records have their own names, so they sit next to Loops' DKIM records.
- Keep the one `_dmarc` record of the domain or its parent. Never add a second one, even when Loops' records page shows one.

## Migration key

Loops API keys have no permissions to choose: every key can send and change the account. So the run never reads the app's own key. When the person chooses the API over the dashboard, ask them to create a separate key for the migration in Loops (Settings, then API, then Generate key), store it in `LOOPS_MIGRATION_API_KEY` in the git-ignored env file, and note in the plan that the run created it. Use it only for the reads below. Its last use is the suppression check in Step 5. At the end of Step 5, on every way out of it, ask the person to revoke the key in Loops (the trash icon next to it on the API settings page) and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

An app with several Loops teams, one per sending domain, needs one migration key per team: each team's emails and contacts are visible only to its own keys. Match each site to its team by the API key variable its client reads. Ask for one key per team, each in its own variable, such as `LOOPS_MIGRATION_API_KEY_MAIL_EXAMPLE_COM`, read each team's emails and audience with its own key, and ask the person to revoke every one at the end of Step 5.

The steps call this key the full-access provider key.

## Template content

A site whose Loops email the person moves to PostHog needs the content of its published version, to check it before they make the PostHog template.

**Copy from the dashboard.** Ask the person to open the transactional email in Loops, and to give you:

- the Name, From, Reply, Subject, Preview, CC, and BCC fields (click `>` to show all of them), with any data variable in them;
- the email's text, with each data variable where it stands, each array block with its variable name and the variables inside it, and each conditional section with its condition;
- each optional data variable and its fallback value;
- the example payload from the email's Publish page (**Show payload**), which lists its data variables.

An email made from uploaded MJML: ask for the MJML file instead of the text.

**Read from the API.** With `Authorization: Bearer $LOOPS_MIGRATION_API_KEY`:

1. `GET https://app.loops.so/api/v1/transactional-emails/{transactionalId}` answers `publishedEmailMessageId` and `dataVariables`, the names the published version uses.
2. `GET https://app.loops.so/api/v1/email-messages/{publishedEmailMessageId}` answers `subject`, `fromName`, `fromEmail` (the part before the sending domain), `replyToEmail`, `ccEmail` and `bccEmail` (only when set), `dataVariablesFallbacks`, and `lmx`, the body in LMX, where a data variable is `{data.name}`.

- A `401` means the key is wrong, or the content API is not on for the team. Ask for the dashboard copy instead.
- A `409` means the email was made from MJML. Ask for the MJML file instead.
- These routes allow 60 requests per 60 seconds for each team. Wait and retry on `429`.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which Step 3 deletes once the site is classified. Never write the content into the plan or the report.

## Suppression list

Loops suppresses an address after a hard bounce or a spam complaint, and skips it on every later send. **Loops has no export of its suppression list, and no API route that lists it.** It only answers for one contact at a time. Say this plainly to the person, and offer these ways instead:

**The app's own record (preferred).** When the app keeps the addresses its Loops webhook reported, such as from `email.hardBounced` and `email.spamReported` events, ask the person to export those addresses from the app's database to a CSV outside the repository, with a column that says which event each came from, and tell you where they saved it. Ask whether the app kept those events since its first Loops send. When it didn't, the record misses the older suppressions: import it, and write the phase as `- [ ] suppressions — <imported>/<entries> imported: the app's record starts after its first Loops send`. The record keeps an address after someone removed its suppression in Loops. Before the import, check each address in it with the suppression route below, at the same rate and with the key of the team that sent to it: drop an address whose `isSuppressed` is `false`, and keep one that answers `404`, which is not a contact.

**Check each contact through the API.** Ask the person to download their audience from Loops (Audience, then the `•••` menu, then **Download**) to a file outside the repository, and tell you where it is. For each address in its email column, call `GET https://app.loops.so/api/v1/contacts/suppression?email=<the address, URL-encoded>` with `Authorization: Bearer $LOOPS_MIGRATION_API_KEY`. Take each answer whose `isSuppressed` is `true`. A `404` means the address is not a contact: skip it. Loops allows 10 requests per second for each team, and the app's own sends share that team's limit, so send at most 5 requests per second, and wait and retry on `429`. Tell the person how long that takes for their count, that it shares the app's sending limit, and that a quiet hour is the best time, and ask whether to go on.

An app with several Loops teams runs this check once per team: ask for each team's audience export, and check its addresses with that team's own migration key, such as `$LOOPS_MIGRATION_API_KEY_MAIL_EXAMPLE_COM`. Each team has its own limit, so each team's check gets its own 5 requests per second, and only that team's sends share it. Tell the person the time for each team. An address that one team suppressed is imported once, whichever team's check found it. This finds only addresses that are contacts in the audience: a transactional send alone does not add its recipient to the audience. So this check never covers the whole list: write the phase as `- [ ] suppressions — <imported>/<entries> imported: audience contacts only`, so the report lists the import as partial.

When the person has neither, the import is not done: write why in the plan.

**Map each entry.**

| Loops source | PostHog source | Reason |
|---|---|---|
| `email.hardBounced` in the app's record | bounce | `Imported from Loops: hard bounce` |
| `email.spamReported` in the app's record | complaint | `Imported from Loops: spam report` |
| `isSuppressed: true` from the API | manual | `Imported from Loops: suppressed after a hard bounce or a spam complaint` |

**Leave out the rest.**

- **Soft bounces** (`email.softBounced`) are temporary failures, which Loops retries. They are not suppressions.
- **Unsubscribed contacts and mailing list unsubscribes** are marketing preferences. Loops sends transactional email to unsubscribed contacts, and so does PostHog, so nothing changes for them. A hard bounce also unsubscribes the contact at Loops, so `subscribed` false in the audience export does not tell a bounce from a choice: never import it.
