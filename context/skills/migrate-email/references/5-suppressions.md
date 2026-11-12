---
title: Import the suppression list
next_step: 6-key.md
---

# Step 5, import the suppression list

The provider keeps a suppression list: addresses that hard-bounced or marked an email as spam. It skips them on every send. PostHog keeps its own list and starts empty, so without an import the first PostHog sends go to these addresses again. That hurts the sending reputation of the project and the domain. Import the list before cutover.

## Status

```
[STATUS] Importing the suppression list
```

## Re-import only

After the migration, while any site still sends through the provider, the provider keeps adding the addresses that bounce or complain to its list, and PostHog never sees them. So the report asks the person to re-import the list weekly. When the person asks only for that re-import, run this step alone. There is no plan file, and no later step checks the run, so:

1. Check that the app sends to the MCP's project: compare the project token the app reads with `api_token` from the PostHog MCP `projects-get` tool. Read only the token's line of the env file, by searching for the token variable's name: the file also holds secret keys, so never open all of it. When they differ, tell the person which project the app uses, and stop before importing.
2. Do "Check the import tool", "Get the list", "Import it" and "The full-access key", reading the provider's `account.md` for them, and skip the other sections. When the import tool is missing, tell the person to add the addresses the provider added since the last import in PostHog (Workflows, then Messaging, then Suppression list), and go to "The full-access key".
3. Tell the person how many entries you imported, of how many, and stop when this step ends: do not go on to the next step, and change no other file.

## Read the provider's notes

Read the provider's `account.md` first, whether or not the import runs. Its "For the report" section, when it has one, names facts the report carries, such as a count of entries the import leaves out. Find each one as the section says, and write it under the phase in the plan file. Never write an address.

## Check the import tool

Look for the PostHog MCP tool `email-suppressions-add`, and read its schema with `info`.

When it is missing, the import is not available to this person yet. Do not try other tools, and do not use the opt-out tools: opt-outs are marketing preferences, and transactional email ignores them. Tick the phase as `- [ ] suppressions — not imported: no import tool`, do what "Calls that change the provider's list" says, ask about the full-access key as the last section says, and continue to the next step. The report tells the person to add the addresses in PostHog (Workflows, then Messaging, then Suppression list) right before cutover, so the list holds the entries the provider adds until then.

## Get the list

The provider's `account.md` says how to export the list, which entries to take, and how each entry maps to PostHog. When the provider has no export or no API that lists it, `account.md` says where else the list comes from.

- Prefer the export the person downloads from the provider's dashboard. Ask them where they saved the file.
- Read the list from the provider's API only when the person gives you a key that can read it, through an environment variable that `account.md` names. The app's own sending key usually can't, unless `account.md` says it can.
- Keep the list out of the repository. Read the file where the person saved it, or write the API's answer to a file in the system's temporary folder, and delete that file when the import is done.

## Import it

- Send the entries to `email-suppressions-add` in batches of the size its schema allows. Give each entry the source and the reason `account.md` names.
- Repeating an import is safe: an address already on the list stays on it.
- The provider keeps adding to its list while it sends, so the report asks the person for one last import right before cutover, and for the weekly re-import of "Re-import only" while any site stays on the provider after it.
- Never print the addresses, and never write them into the plan or the report. Count them.
- When a call fails, read its error and fix the call. When it fails again, stop the import, record how many entries you imported, and ask the person once whether to repeat it now. Repeat it when they say yes.

## Calls that change the provider's list

The import copies the list once. After it, a call in the app that adds an address to the provider's suppression list, or removes one from it, such as an unsubscribe handler or a reactivation, changes only the provider's list: an address it adds still gets the moved sends, and an address it removes stays blocked in PostHog. For each such call in Step 3's list of other calls, add to the report's "Before cutover" that the person makes the call change PostHog's suppression list too, before the deploy, for the entries the import would take. An address it adds goes on PostHog's list, with a reason that starts with `Synced from <provider name>`. An address it removes comes off PostHog's list only when no other list the import took still holds it, and only when its PostHog entry is one the import or such a call made, with a reason that starts with `Imported from <provider name>` or `Synced from <provider name>`. An entry PostHog recorded itself, such as a bounce of a moved send, stays. The call keeps its provider write while any send still goes through the provider. The provider's `mapping.md` names its calls, and says which entries count when the import takes only some.

## Write down

Tick the phase in the plan file only when every entry is imported: `- [x] suppressions — <entries>/<entries> imported`. When the list is empty, write `- [x] suppressions — empty list`. When the import stopped partway, write `- [ ] suppressions — <imported>/<entries> imported: <the error>`. When the person has no export and no key, write `- [ ] suppressions — not imported: <why>`.

## The full-access key

Every way out of this step ends here. When the plan says the run created a full-access provider key, or a re-import created one, ask the person now to delete it at the provider and remove its variable from the env file, as `account.md` says. After a partial import, ask once the person said no to a repeat, or the repeat ended. Note in the plan whether they did, outside a re-import.
