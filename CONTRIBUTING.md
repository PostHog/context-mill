# Contributing to context-mill

This is the contributor doc for `context/skills/` and the
`scripts/` build pipeline. For docs aimed at consumers of the published
manifest, see the [README](README.md).

## How skills get into the wizard CLI

Every skill ships with a `config.yaml`. An optional `cli:` block on that
config tells the PostHog wizard whether and how this skill appears as a
**hat** — a typed wizard command (you wear a different hat to do a different
thing). The block is parsed in `scripts/lib/skill-generator.js` and
emitted as `hatEntries` inside `dist/skills/skill-menu.json`. The wizard
fetches `skill-menu.json` at runtime and registers each hat as a
command, so adding a new hat is a context-mill release
— no wizard release needed.

> **Legacy spellings:** the pre-rename keys `role: command`, `command:`, and
> `parentCommand:` are still accepted on input and normalized to `hat` /
> `hat:` / `parentHat:`. The build also emits a legacy `cliEntries` mirror
> (old `role: command` shape) next to `hatEntries` so the current wizard keeps
> resolving; both go away once the wizard reads `hatEntries`. Write new skills
> with the `hat` vocabulary below.

### The `cli:` block schema

```yaml
type: docs-only
description: Audit captured events
cli:
  role: hat          # hat | skill | internal
  parentHat: audit   # the hat this skill nests under (optional)
  hat: events        # the user-typed word; required when role is hat
  default: true      # optional — the leaf `wizard <family>` runs by default
```

Three values for `role`:

| Role | Where it shows up |
|---|---|
| `hat` | Registered as `wizard <parentHat> <hat>` (or `wizard <hat>` if no parent). The user-facing CLI command. |
| `skill` | Reachable only via `wizard skill <id>`. The full discoverable set. |
| `internal` | Hidden everywhere. Only reachable via `wizard --skill=<id>` (a dev escape hatch). Useful for in-progress skills that aren't ready to expose. |

Skills with **no** `cli:` block default to the `skill` role — they're
discoverable via `wizard skill list` but don't get a top-level command.

The same skill can be either surface: `audit-events` sets `role: hat` so it's
`wizard audit events`; a `role: skill` skill is only `wizard skill <id>`. One
mechanism, two surfaces — so `wizard audit <subcommand>` chooses an audit area,
it does **not** take a skill name.

### Flat vs. family — the convention

> A hat is **flat** when there's only one option today,
> **a family** when the user must pick among multiple distinct things.

Don't pre-create a family form for a single-option hat. If only one
migration vendor exists, the command is `wizard migrate` — not
`wizard migrate statsig`. When a second vendor arrives, restructure to
a family at that moment and document the UX change in the wizard's
release notes. Forced abstraction (`wizard migrate <vendor>` with one
vendor) is worse than the breaking change you'd cause later — that
change is real and worth notifying users about explicitly.

### Migrating a flat hat into a family

When a flat hat needs to grow into a family (a second option arrived,
the original is being renamed, etc.), the `cli:` block restructures like
this:

```yaml
# Before — flat hat. Registers `wizard investigate`.
cli:
  role: hat
  hat: investigate

# After — family with a subcommand. Registers `wizard investigate events`.
cli:
  role: hat
  parentHat: investigate
  hat: events
```

**This is a breaking change for users.** Anyone scripting the old flat
form (e.g. `wizard investigate` in CI) will break the moment the new
manifest ships — the parent name now expects a subcommand and opens the
family picker. Treat this exactly like any other breaking CLI change:

1. Land the YAML change in context-mill.
2. Call out the migration explicitly in the wizard release notes for the
   release that picks up the new manifest — what the old command was,
   what the new shape is, and what users need to change.
3. If the old flat name is still meaningful as a default leaf of the new
   family, mark that leaf `default: true` so `wizard investigate` →
   Enter still runs the intended action with one keystroke.

Going the other way — collapsing a family back to a flat hat — works
the same way and is also a breaking change. Don't do it casually.

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
# 1. Flat hat (single option today)
cli:                                                   →  wizard revenue-analytics
  role: hat
  hat: revenue-analytics

# 2. Nested hat inside an existing family
cli:                                                   →  wizard audit feature-flags
  role: hat
  parentHat: audit
  hat: feature-flags

# 3. Default leaf — what `wizard audit` runs with no subcommand
cli:                                                   →  wizard audit all
  role: hat                                               `wizard audit` runs
  parentHat: audit                                        this leaf by default
  hat: all                                                (and pre-highlights it
  default: true                                           in the picker later).

# 4. Skill-only (reachable via `wizard skill <id>`)
cli:                                                   →  wizard skill <skill-id>
  role: skill
```

The block can live at the **group level** (defaults for every variant) or
inside a **single variant** (overrides the group-level defaults). When
`role: hat` and `hat` is omitted, the variant id fills in as the
hat name — except for the magic `id: all` variant, which collapses to
the group key and so requires an explicit `hat` at the group level.

`cli:` only configures the **command shape** — the verbs the user types.
Flags and positional arguments live on the wizard side
(`ProgramConfig.cliOptions`), not here.

### What `default: true` does

`default: true` marks the leaf that `wizard <family>` runs when no subcommand
is given. Today, when a family surfaces a single leaf, `wizard <family>` runs it
directly — the user lands on its intro screen. Once a family surfaces several,
the wizard opens an interactive picker with the `default` leaf pre-highlighted,
so a single Enter runs it while the others stay visible. Set `default` on the
leaf a user typing `wizard <family>` should get by default. At most one leaf per
family should be marked.

## Promotion criterion for `role: hat`

The wizard's command surface is **curated, not inclusive**. Every hat
is one we're willing to teach in our docs, announce, and support
for end users — not just every skill we've authored.

A skill should be promoted to `role: hat` when **all** of these are
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
4. **It plays well with the family it lives in.** If `parentHat:
   audit`, the skill should slot alongside the other audits at the same
   level of abstraction. Don't put a one-off in an existing family just
   because the words overlap.
5. **A wizard maintainer has reviewed the role change.** Adding to the
   command surface is a permanent commitment to that name. Loop in the wizard
   docs team / maintainers on PRs that change a skill to `role: hat`.

When in doubt, ship as `role: skill`. Promoting from skill to hat is
cheap; demoting from hat to skill breaks user scripts.

## Adding a new skill

The base path is the same regardless of the skill's CLI role:

1. Create `context/skills/<your-skill>/`.
2. Add a `config.yaml` declaring `type`, `description`, `variants`, etc.
   See an existing skill (e.g. `audit-events`, `migrate`) for the shape.
3. Add a `description.md` template and any `references/*.md` files.
4. If the skill should be a wizard command, add a `cli:` block (a hat) per
   the schema above.
5. Run `npm test && npm run build`. The build emits the new skill into
   `dist/skills/<your-skill>.zip` and lists it in the manifest.

## Adding a new hat

When you've decided your skill meets the `role: hat` criterion:

1. Add the `cli:` block to the skill's `config.yaml` with `role:
   hat`, the right `parentHat` (if it nests under an existing
   family), and `hat`.
2. Confirm `npm run build` emits the entry under `hatEntries` inside
   `dist/skills/skill-menu.json` with the right `parentHat` /
   `hat` values. The wizard picks it up on its next invocation
   (no wizard release needed).
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
- Hat entries emit: `scripts/lib/build-phases.js` (`generateHatEntries`, plus
  `toLegacyCliEntries` for the back-compat `cliEntries` mirror)
- Tests for the cli block parser: `scripts/lib/tests/cli-block.test.js`
- The wizard's side of the contract: [PostHog/wizard CONTRIBUTING.md](https://github.com/PostHog/wizard/blob/main/CONTRIBUTING.md)

Questions: drop a note in
[#team-docs-and-wizard](https://posthog.slack.com/archives/C09GTQY5RLZ) or
open an issue.
