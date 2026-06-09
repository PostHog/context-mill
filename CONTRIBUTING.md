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
  surface: public        # public | catalog | internal
  parentCommand: audit   # the command this skill nests under (optional)
  command: events        # the user-typed word; required when public
```

Three values for `surface`:

| Surface | Where it shows up |
|---|---|
| `public` | Registered as `wizard <parentCommand> <command>` (or `wizard <command>` if no parent). The user-facing CLI. |
| `catalog` | Reachable only via `wizard skill <id>`. The full discoverable set. |
| `internal` | Hidden everywhere. Only reachable via `wizard --skill=<id>` (a dev escape hatch). Useful for in-progress skills that aren't ready to expose. |

Skills with **no** `cli:` block default to `catalog` — they're discoverable
via `wizard skill list` but don't get a top-level command.

### Mapping table — YAML on the left, registered command on the right

```yaml
# 1. Flat command
cli:                                          →  wizard revenue
  surface: public
  command: revenue

# 2. Nested command
cli:                                          →  wizard audit events
  surface: public
  parentCommand: audit
  command: events

# 3. Family where command name comes from variant id
cli:                                          →  wizard migrate <variant.id>
  surface: public                                (e.g. `wizard migrate statsig`
  parentCommand: migrate                          when variant `statsig` is set)

# 4. Catalog-only (reachable via `wizard skill <id>`)
cli:                                          →  wizard skill <skill-id>
  surface: catalog
```

The block can live at the **group level** (defaults for every variant) or
inside a **single variant** (overrides the group-level defaults). When
`surface: public` and `command` is omitted, the variant id fills in as the
command name — except for the magic `id: all` variant, which collapses to
the group key and so requires an explicit `command` at the group level.

`cli:` only configures the **command shape** — the verbs the user types.
Flags and positional arguments live on the wizard side
(`ProgramConfig.cliOptions`), not here.

## Promotion criterion for `surface: public`

The wizard's public surface is **curated, not inclusive**. Every public
command is one we're willing to teach in our docs, announce, and support
for end users — not just every skill we've authored.

A skill should be promoted to `surface: public` when **all** of these are
true:

1. **It's user-facing, not infrastructure.** The skill represents a setup,
   audit, or migration workflow an end user would reasonably invoke
   directly. Internal helpers and scaffolding skills stay at `catalog`.
2. **The name reads naturally.** `wizard audit events` is obvious. `wizard
   do-the-thing-with-events` is not. If you have to explain the command in
   the docs before someone could guess what it does, the name needs more
   work or the skill belongs at `catalog` until it does.
3. **It's stable.** Public surface is hard to deprecate without breaking
   users. If the skill is still iterating on what it does or how it
   prompts the agent, ship it as `catalog` first. Promote when the shape
   has held for a release or two.
4. **It plays well with the family it lives in.** If `parentCommand:
   audit`, the skill should slot alongside the other audits at the same
   level of abstraction. Don't put a one-off in an existing family just
   because the words overlap.
5. **A wizard maintainer has reviewed the surface change.** Adding to the
   public CLI is a permanent commitment to that name. Loop in the wizard
   docs team / maintainers on PRs that change `surface: public`.

When in doubt, ship as `catalog`. Promoting from catalog to public is
cheap; demoting from public to catalog breaks user scripts.

## Adding a new skill

The base path is the same regardless of CLI surface:

1. Create `transformation-config/skills/<your-skill>/`.
2. Add a `config.yaml` declaring `type`, `description`, `variants`, etc.
   See an existing skill (e.g. `audit-events`, `migrate`) for the shape.
3. Add a `description.md` template and any `references/*.md` files.
4. If the skill should be a wizard command, add a `cli:` block per the
   schema above.
5. Run `npm test && npm run build`. The build emits the new skill into
   `dist/skills/<your-skill>.zip` and lists it in the manifest.

## Adding a new public command

When you've decided your skill meets the `surface: public` criterion:

1. Add the `cli:` block to the skill's `config.yaml` with `surface:
   public`, the right `parentCommand` (if it nests under an existing
   family), and `command`.
2. Confirm `npm run build` emits the entry in
   `dist/skills/cli-manifest.json` with the right `parentCommand` /
   `command` values. The wizard's next release picks it up automatically.
3. No wizard PR is needed for skill-backed public commands. If you also
   need wizard-side hooks (custom outro, content blocks, abort cases),
   that's a wizard PR — but the CLI registration is handled by the
   manifest.

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
