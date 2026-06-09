# Contributing to context-mill

This is the contributor doc for `transformation-config/skills/` and the
`scripts/` build pipeline. For docs aimed at consumers of the published
manifest, see the [README](README.md).

## How skills get into the wizard CLI

Every skill ships with a `config.yaml`. An optional `cli:` block on that
config tells the PostHog wizard whether and how this skill appears as a
command. The block is parsed in `scripts/lib/skill-generator.js` and
emitted into `dist/skills/cli-manifest.json` alongside the regular
manifest. The wizard snapshots that file at build time and turns each
entry into a registered command.

### The `cli:` block schema

```yaml
type: docs-only
description: Audit captured events
cli:
  role: command          # command | skill | internal
  parentCommand: audit   # the command this skill nests under (optional)
  command: events        # the user-typed word; required when role is command
  recommended: true      # optional — pre-highlight this leaf in the family picker
```

Three values for `role`:

| Role | Where it shows up |
|---|---|
| `command` | Registered as `wizard <parentCommand> <command>` (or `wizard <command>` if no parent). The user-facing CLI. |
| `skill` | Reachable only via `wizard skill <id>`. The full discoverable set. |
| `internal` | Hidden everywhere. Only reachable via `wizard --skill=<id>` (a dev escape hatch). Useful for in-progress skills that aren't ready to expose. |

Skills with **no** `cli:` block default to the `skill` role — they're
discoverable via `wizard skill list` but don't get a top-level command.

### Flat vs. family — the convention

> A command is **flat** when there's only one option today,
> **a family** when the user must pick among multiple distinct things.

Don't pre-create a family form for a single-option command. If only one
migration vendor exists, the command is `wizard migrate` — not
`wizard migrate statsig`. When a second vendor arrives, restructure to
a family at that moment and document the UX change in the wizard's
release notes. Forced abstraction (`wizard migrate <vendor>` with one
vendor) is worse than the breaking change you'd cause later — that
change is real and worth notifying users about explicitly.

### Naming rule — no shorthand for product names

Use the **full PostHog product name** with hyphens, not abbreviations.

|     | Good | Bad |
|---|---|---|
| Feature flags audit | `wizard audit feature-flags` | `wizard audit flags` |
| Session replay audit | `wizard audit session-replay` | `wizard audit replay` |
| Revenue analytics | `wizard revenue-analytics` | `wizard revenue` |
| Web analytics | `wizard web-analytics` | `wizard web` |
| LLM analytics | `wizard llm-analytics` | `wizard llms` |

The kebab-case / length / reserved-word checks in `parseCliBlock`
enforce the mechanics; this rule is the naming taste layer on top of
them. Users typing the full product name once is cheap; getting them
to relearn an abbreviation we changed our mind on later is not.

### Mapping table — YAML on the left, registered command on the right

```yaml
# 1. Flat command (single option today)
cli:                                                   →  wizard revenue-analytics
  role: command
  command: revenue-analytics

# 2. Nested command inside an existing family
cli:                                                   →  wizard audit feature-flags
  role: command
  parentCommand: audit
  command: feature-flags

# 3. Recommended leaf — pre-highlighted in the family picker
cli:                                                   →  wizard audit all
  role: command                                           Pre-highlighted in the
  parentCommand: audit                                    family picker, so
  command: all                                            `wizard audit` → Enter
  recommended: true                                       runs this leaf.

# 4. Skill-only (reachable via `wizard skill <id>`)
cli:                                                   →  wizard skill <skill-id>
  role: skill
```

The block can live at the **group level** (defaults for every variant) or
inside a **single variant** (overrides the group-level defaults). When
`role: command` and `command` is omitted, the variant id fills in as the
command name — except for the magic `id: all` variant, which collapses to
the group key and so requires an explicit `command` at the group level.

`cli:` only configures the **command shape** — the verbs the user types.
Flags and positional arguments live on the wizard side
(`ProgramConfig.cliOptions`), not here.

### What `recommended: true` does (and doesn't do)

`recommended: true` controls **picker pre-highlighting**, not auto-run. When
the user invokes a family parent with no subcommand, the wizard always
opens an interactive picker over the family's children — the
recommended child is sorted to the top so a single Enter keystroke
runs it. The picker still appears (so the user sees every option before
committing). Set `recommended` on the leaf you'd want a user typing
`wizard <family>` to invoke if they don't change the selection. At most
one leaf per family should be marked.

## Promotion criterion for `role: command`

The wizard's command surface is **curated, not inclusive**. Every command
is one we're willing to teach in our docs, announce, and support
for end users — not just every skill we've authored.

A skill should be promoted to `role: command` when **all** of these are
true:

1. **It's user-facing, not infrastructure.** The skill represents a setup,
   audit, or migration workflow an end user would reasonably invoke
   directly. Internal helpers and scaffolding skills stay at `role: skill`.
2. **The name reads naturally.** `wizard audit events` is obvious. `wizard
   do-the-thing-with-events` is not. If you have to explain the command in
   the docs before someone could guess what it does, the name needs more
   work or the skill belongs at `role: skill` until it does.
3. **It's stable.** The command surface is hard to deprecate without breaking
   users. If the skill is still iterating on what it does or how it
   prompts the agent, ship it as `role: skill` first. Promote when the shape
   has held for a release or two.
4. **It plays well with the family it lives in.** If `parentCommand:
   audit`, the skill should slot alongside the other audits at the same
   level of abstraction. Don't put a one-off in an existing family just
   because the words overlap.
5. **A wizard maintainer has reviewed the role change.** Adding to the
   command surface is a permanent commitment to that name. Loop in the wizard
   docs team / maintainers on PRs that change a skill to `role: command`.

When in doubt, ship as `role: skill`. Promoting from skill to command is
cheap; demoting from command to skill breaks user scripts.

## Adding a new skill

The base path is the same regardless of the skill's CLI role:

1. Create `transformation-config/skills/<your-skill>/`.
2. Add a `config.yaml` declaring `type`, `description`, `variants`, etc.
   See an existing skill (e.g. `audit-events`, `migrate`) for the shape.
3. Add a `description.md` template and any `references/*.md` files.
4. If the skill should be a wizard command, add a `cli:` block per the
   schema above.
5. Run `npm test && npm run build`. The build emits the new skill into
   `dist/skills/<your-skill>.zip` and lists it in the manifest.

## Adding a new command

When you've decided your skill meets the `role: command` criterion:

1. Add the `cli:` block to the skill's `config.yaml` with `role:
   command`, the right `parentCommand` (if it nests under an existing
   family), and `command`.
2. Confirm `npm run build` emits the entry in
   `dist/skills/cli-manifest.json` with the right `parentCommand` /
   `command` values. The wizard's next release picks it up automatically.
3. No wizard PR is needed for skill-backed public commands. If you also
   need wizard-side hooks (custom outro, content blocks, abort cases),
   that's a wizard PR — but the CLI registration is handled by the
   manifest.

### Heads up: wizard's `docs/cli.md` needs regeneration

The wizard ships a committed `docs/cli.md` auto-generated from the
manifest. When the wizard upgrades to a release containing your new
`cli:` block, **the wizard maintainer must run `pnpm docs:cli` in the
wizard repo** to refresh that file. Open a tracking issue on the wizard
side (or flag it in the wizard release PR) so it doesn't get skipped.

If you're the wizard maintainer on the receiving end: any change to
`cli-manifest.bootstrap.json` or to which manifest version the wizard
consumes is a signal to regenerate. See
[PostHog/wizard CONTRIBUTING.md](https://github.com/PostHog/wizard/blob/main/CONTRIBUTING.md#when-to-regenerate-docscli-md).

## What goes here vs. in the wizard repo

| If you're changing… | …PR goes to |
|---|---|
| Skill markdown content | `context-mill` |
| Skill `config.yaml` (including `cli:` blocks) | `context-mill` |
| Skill-generation scripts (`scripts/lib/`) | `context-mill` |
| YARA-X security rules | `warlock` |
| Wizard runner pipeline, TUI, agent runtime | `wizard` |
| Wizard-native programs (doctor, mcp, source-maps) | `wizard` |
| Wizard CLI factories and bin.ts wiring | `wizard` |

If a change crosses two repos, ship the context-mill PR first so the
manifest is published before the wizard tries to consume it.

## Where to look for more

- Skill schema details: `scripts/lib/skill-generator.js`
  (`parseCliBlock`, `expandSkillGroups`, JSDoc typedef for the `cli:` block)
- CLI manifest emit: `scripts/lib/build-phases.js` (`generateCliManifest`)
- Tests for the cli block parser: `scripts/lib/tests/cli-block.test.js`
- The wizard's side of the contract: [PostHog/wizard CONTRIBUTING.md](https://github.com/PostHog/wizard/blob/main/CONTRIBUTING.md)

Questions: drop a note in
[#team-docs-and-wizard](https://posthog.slack.com/archives/C09GTQY5RLZ) or
open an issue.
