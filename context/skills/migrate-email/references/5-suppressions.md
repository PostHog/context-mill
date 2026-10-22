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

## Check the import tool

Look for the PostHog MCP tool `email-suppressions-add`, and read its schema with `info`.

When it is missing, the import is not available to this person yet. Do not try other tools, and do not use the opt-out tools: opt-outs are marketing preferences, and transactional email ignores them. Tick the phase as `- [ ] suppressions — not imported: no import tool`, and continue to the next step. The report tells the person to add the addresses in PostHog (Workflows, then Messaging, then Suppression list) before cutover.

## Get the list

Read the provider's `account.md`. It says how to export the list, which entries to take, and how each entry maps to PostHog.

- Prefer the export the person downloads from the provider's dashboard. Ask them where they saved the file.
- Read the list from the provider's API only when the person gives you a key that can read it, through an environment variable that `account.md` names. The app's own sending key usually can't.
- Keep the list out of the repository. Read the file where the person saved it, or write the API's answer to a file in the system's temporary folder, and delete that file when the import is done.

## Import it

- Send the entries to `email-suppressions-add` in batches of the size its schema allows. Give each entry the source and the reason `account.md` names.
- Repeating an import is safe: an address already on the list stays on it.
- Never print the addresses, and never write them into the plan or the report. Count them.
- When a call fails, read its error and fix the call. When it fails again, stop the import and record how many entries you imported.

## Write down

Tick the phase in the plan file: `- [x] suppressions — <imported>/<entries> imported`. When the list is empty, write `- [x] suppressions — empty list`. When the person has no export and no key, write `- [ ] suppressions — not imported: <why>`.
