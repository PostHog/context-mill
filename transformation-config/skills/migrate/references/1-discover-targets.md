---
title: Discover migration targets
next_step: 2-install-sdk.md
---

# Step 1 — Discover migration targets and install guide skills

> Discovery + skill install only. Do not modify project source files in this step.

## Status

Emit:

```
[STATUS] Discovering migration targets
[STATUS] Installing migration guide skills
```

## Catalog

The supported migration sources for this skill:

| ID            | Display name | Grep pattern (case-insensitive)                       | Skill ID                          | Picker hint                              |
|---------------|--------------|-------------------------------------------------------|-----------------------------------|------------------------------------------|
| launchdarkly  | LaunchDarkly | `launchdarkly\|LDClient\|ld-client`                   | `migration-source-launchdarkly`   | `feature flags · ~40KB · $8.33/mo+`      |
| amplitude     | Amplitude    | `@amplitude\|amplitude\.getInstance\|Amplitude\.init` | `migration-source-amplitude`      | `product analytics · ~60KB · $49/mo+`    |

If a source is not in this catalog, it is not supported by this skill. Do not invent entries.

## Procedure

### a. Detect candidate targets

For each catalog entry, run the `Grep` tool against the install directory using the listed pattern (case-insensitive). A non-empty result means the target is **present** in the project. Build the list of present target IDs.

If no targets are present, write `[]` to `.selected-targets.txt` at the project root, emit `[ABORT] No supported migration sources found`, and stop. The wizard catches `[ABORT]` and terminates the run.

### b. Ask the user which to migrate

If one or more targets are present, call the MCP tool `mcp__wizard-tools__prompt_user` with:

- `title`: `"Select migration targets"`
- `message`: `"Found candidate migration sources in this project. Pick the ones you want to migrate."`
- `mode`: `"multi"`
- `options`: an array of `{ label: <Display name>, value: <id>, hint: <Picker hint from catalog> }` for each present target. The hint is rendered next to the label in parentheses, so the user sees product category, SDK size, and pre-migration cost at a glance.

The tool blocks until the user answers and returns a JSON array of selected `value`s in the tool result, e.g. `["launchdarkly"]` or `["launchdarkly","amplitude"]`.

If the user selects nothing (`[]`), write `[]` to `.selected-targets.txt`, emit `[ABORT] No supported migration sources found`, and stop.

### c. Record the selection

Write the user's selection to `.selected-targets.txt` at the project root. The file content is the JSON array of selected ids exactly as returned by `prompt_user`.

### d. Install the matching migration-source skill(s)

For each id in the selection, call `mcp__wizard-tools__install_skill` with the matching skill ID from the catalog table. For example, if the user selected `launchdarkly`, call:

```
mcp__wizard-tools__install_skill({ skillId: "migration-source-launchdarkly" })
```

Do this once per selected id. Each install lands the migration guide skill at `.claude/skills/<skillId>/`. The reference markdown inside is the canonical replacement guide for that source — Step 4 reads it. **Do not** read the migration guide content yet; that's Step 4's job.

If `install_skill` returns an error for any id, emit `[ABORT] Could not install migration guide skill: <skillId>` and stop.

Emit `[STATUS] Wrote .selected-targets.txt` once the file is written and all guide skills are installed, then continue to the next step.
