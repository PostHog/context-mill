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

Loops API keys have no permissions to choose: every key can send and change the account. So the run never reads the app's own key. When the person chooses the API over the dashboard for template content, or when the suppression import below checks addresses, whichever comes first, ask them to create a separate key for the migration in Loops (Settings, then API, then Generate key), store it in `LOOPS_MIGRATION_API_KEY` in the git-ignored env file, and write it into the plan as Step 3's plan layout says. Use it only for the reads below. Its last use is the suppression check in Step 5. At the end of Step 5, on every way out of it, ask the person to revoke the key in Loops (the trash icon next to it on the API settings page) and remove its variable from the env file, and note in the plan whether they did. The report reminds them when they didn't. Never print the key, and never write it into another file.

An app with several Loops teams, one per sending domain, needs one migration key per team: each team's emails and contacts are visible only to its own keys. Match each site to its team by the API key variable its client reads. Ask for one key per team, each in its own variable, such as `LOOPS_MIGRATION_API_KEY_MAIL_EXAMPLE_COM`, read each team's emails and audience with its own key, and ask the person to revoke every one at the end of Step 5.

The steps call this key the full-access provider key.

## Template content

Every Loops site sends a Loops email, so each site that moves needs the content of the email's published version: Step 3 checks it, and Step 7 brings it into the code, or the person makes a template in PostHog from it when they ask for one. The API returns the content, but not as HTML: it answers the body in LMX, Loops' markup, which `mapping.md` turns into HTML under "Templates". The dashboard has no export of an email's HTML, so its copy is a preview send.

**Read from the API.** With `Authorization: Bearer $LOOPS_MIGRATION_API_KEY`:

1. `GET https://app.loops.so/api/v1/transactional-emails/{transactionalId}` answers `publishedEmailMessageId` and `dataVariables`, the names the published version uses.
2. `GET https://app.loops.so/api/v1/email-messages/{publishedEmailMessageId}` answers `subject`, `previewText`, `fromName`, `fromEmail` (the part before the sending domain), `replyToEmail`, `ccEmail` and `bccEmail` (only when set), `languageCode` (only when set), `emailFormat` (`styled` or `plain`), `dataVariablesFallbacks` (only when set), and `lmx`, the body in LMX.
3. For a `<Style themeId="…" />` in the LMX, `GET https://app.loops.so/api/v1/themes/{themeId}` answers its `styles`, with the names of the `<Style />` attributes.
4. For each `<Component componentId="…" />`, `GET https://app.loops.so/api/v1/components/{componentId}` answers its `lmx`.

- A `401` means the key is wrong, or the content API is not on for the team. Ask for the preview send instead.
- A `409` means the email was made from MJML, or Loops can't give its content as LMX. Ask for the preview send instead.
- These routes allow 60 requests per 60 seconds for each team. Wait and retry on `429`.

**Copy a preview send.** Ask the person to open the transactional email in Loops, switch to its published version with the toggle in the top right when it has a draft, and give you:

- the Name, From, Reply, Subject, Preview, CC, and BCC fields (click `>` to show all of them), with any data variable in them;
- each optional data variable and its fallback value, each conditional section with its condition, and each array block with its variable name and the variables inside it, with their **Array item** option;
- the example payload from the email's Publish page (**Show payload**), which lists its data variables;
- a preview of it: **Send a preview**, with **Add preview tag** off, each data variable filled with its own name in double brackets, such as `[[firstName]]`, and each array with two items when the form takes them. That marker also shows a section with no operator. A section that needs another value to show, such as `pro` for `equal` or `contains`, or an empty value for `empty`, needs a second preview with that value, and so does a section that shows only when another one hides. Ask them to save the raw message they get, such as Gmail's **Show original**, then **Download original**, as a `.eml` file outside the repository.

A preview send is also how you read a theme or a social icon that the API doesn't give: ask for one when `mapping.md` says so.

**An email made from MJML.** The API answers `409`, and the editor shows the **Code** option. Ask for the preview send: its HTML is the MJML that Loops compiled. When the person has the MJML file they uploaded, and it has no `<loops-array>` and no `img` folder, you can instead compile it once with the MJML CLI, in a folder in the system's temporary folder, only when the person allows it. Never add MJML to the app. Without either, the site stays, and the reason is `MJML email not compiled`.

Read the person's copies where they saved them. An API answer goes only into the temporary file Step 3 writes, which is deleted as `template-to-code.md` says. Never write the content into the plan or the report.

## Open and click tracking

Loops tracks no opens or clicks on a transactional email, at any setting or plan, so there is nothing to check in the account and no case where nobody can tell:

- Every Loops site's emails had no open pixel, as Step 3 says under "Opens the provider didn't track".
- A Loops site that moves to a template made in PostHog is one whose clicks the provider didn't track, as Step 3 says under "A template in PostHog".

## Suppression list

Loops suppresses an address after a hard bounce or a spam complaint, and skips it on every later send. **Loops has no export of its suppression list, and no API route that lists it.** It only answers for one contact at a time. Say this plainly to the person, and offer these ways instead:

**The app's own record (preferred).** When the app keeps the addresses its Loops webhook reported, such as from `email.hardBounced` and `email.spamReported` events, ask the person to export those addresses from the app's database to a CSV outside the repository, with a column that says which event each came from, and tell you where they saved it. Ask whether the app kept those events since its first Loops send. When it didn't, the record misses the older suppressions: import it, and write the phase as `- [ ] suppressions — <imported>/<entries> imported: the app's record starts after its first Loops send`. The record keeps an address after someone removed its suppression in Loops. Before the import, check each address in it with the suppression route below, at the same rate and with the key of the team that sent to it: drop an address whose `isSuppressed` is `false`, and keep one that answers `404`, which is not a contact.

**Check each contact through the API.** Ask the person to download their audience from Loops (Audience, then the `•••` menu, then **Download**) to a file outside the repository, and tell you where it is. For each address in its email column, call `GET https://app.loops.so/api/v1/contacts/suppression?email=<the address, URL-encoded>` with `Authorization: Bearer $LOOPS_MIGRATION_API_KEY`. Take each answer whose `isSuppressed` is `true`. A `404` means the address is not a contact: skip it. Loops allows 10 requests per second for each team, and the app's own sends share that team's limit, so send at most 5 requests per second, and wait and retry on `429`. Tell the person how long that takes for their count, that it shares the app's sending limit, and that a quiet hour is the best time, and ask whether to go on.

An app with several Loops teams runs this check once per team: ask for each team's audience export, and check its addresses with that team's own migration key, such as `$LOOPS_MIGRATION_API_KEY_MAIL_EXAMPLE_COM`. Each team has its own limit, so each team's check gets its own 5 requests per second, and only that team's sends share it. Tell the person the time for each team. PostHog keeps one suppression list per project, so the import puts every team's suppressed addresses into that one list, and PostHog then refuses a moved send of any team to an address that another team suppressed. Tell the person so in Step 3, and ask once whether the moved sites of all teams may share one list. When they say no, ask which one team's sites move: the sites of every other team stay, and the reason is `Loops team <name> keeps its own suppression list`, and only that team's addresses are checked and imported. An address that more than one team suppressed is imported once. This finds only addresses that are contacts in the audience: a transactional send alone does not add its recipient to the audience. So this check never covers the whole list: write the phase as `- [ ] suppressions — <imported>/<entries> imported: audience contacts only`, so the report lists the import as partial.

Both ways check addresses with the migration key. When the person has neither, or won't create the key, the import is not done: write why in the plan.

**Map each entry.**

| Loops source | PostHog source | Reason |
|---|---|---|
| `email.hardBounced` in the app's record | bounce | `Imported from Loops: hard bounce` |
| `email.spamReported` in the app's record | complaint | `Imported from Loops: spam report` |
| `isSuppressed: true` from the API | manual | `Imported from Loops: suppressed after a hard bounce or a spam complaint` |

**Leave out the rest.**

- **Soft bounces** (`email.softBounced`) are temporary failures, which Loops retries. They are not suppressions.
- **Unsubscribed contacts and mailing list unsubscribes** are marketing preferences. Loops sends transactional email to unsubscribed contacts, and so does PostHog, so nothing changes for them. A hard bounce also unsubscribes the contact at Loops, so `subscribed` false in the audience export does not tell a bounce from a choice: never import it.

## For the report

The weekly re-import that the report asks for, while a site stays on Loops, gets its list the same way as the first import. The audience check never sees a recipient who is not an audience contact, so its re-imports never bring in that recipient's bounce or complaint, and a moved send can keep mailing them, past the week the report names. When a site stays and the import was `audience contacts only`, write under the phase: `- re-imports from the audience check miss recipients who are not contacts`. The report then says so beside the weekly re-import, and that the app's record covers them: the app keeps every `email.hardBounced` and `email.spamReported` event its Loops webhook reports from now on, and each re-import reads that record.
