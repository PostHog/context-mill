# AGENTS.md — context-mill

Instructions for all agents (and humans) working in this repo. This is the
single source of truth; [`CLAUDE.md`](CLAUDE.md) just points here.

This repo packages PostHog's developer content (docs, prompts, example code)
into [Agent Skills](https://agentskills.io/specification)-compliant skill
packages. The build pipeline emits a versioned manifest plus per-skill ZIPs,
consumed by the PostHog [wizard](https://github.com/PostHog/wizard) and the
PostHog [MCP server](https://github.com/PostHog/posthog/tree/master/products/mcp).

User-facing intro: [README.md](README.md). Contributor handbook:
[CONTRIBUTING.md](CONTRIBUTING.md).

## What lives where

| Concern | Where |
|---|---|
| Skill source content | `context/skills/<name>/` |
| Skill descriptor / CLI role declarations | `context/skills/<name>/config.yaml` |
| Build pipeline | `scripts/lib/` (skill generator, build phases, change router) |
| Build entrypoints | `scripts/build.js` (full) and `scripts/dev-server.js` (partial / watch) |
| Tests | `scripts/lib/tests/` and `scripts/plugins/tests/` (vitest) |
| Manifest output | `dist/skills/manifest.json`, `dist/skills/skill-menu.json` (CLI entries live under `cliEntries`) |
| Per-skill ZIPs | `dist/skills/<id>.zip` |

## How skills become wizard commands — the `cli:` block

Every skill's `config.yaml` may declare an optional `cli:` block that tells the
wizard whether and how to expose the skill as a CLI command. It's compiled into
`cliEntries` in `dist/skills/skill-menu.json`, which the wizard fetches at
runtime. **Adding or renaming a skill-backed command is a context-mill release —
no wizard code change.** The full schema, the YAML→command mapping, and the
promotion criterion live in
[CONTRIBUTING.md](CONTRIBUTING.md#how-skills-get-into-the-wizard-cli). Quick shape:

```yaml
cli:
  role: command          # command | skill | internal
  parentCommand: audit   # optional — nests this command under another
  command: events        # the user-typed word; required when role is command
```

The parser is `parseCliBlock` in `scripts/lib/skill-generator.js`. It enforces:

- `role` is one of `command`, `skill`, `internal` (default: `skill` if no `cli:` block is set at all)
- `command` and `parentCommand` are kebab-case, 2–20 characters
- Neither field is a yargs reserved word (`help`, `version`, `completion`) or a wizard internal flag (`playground`, `benchmark`, `yara-report`, `local-mcp`, `ci`, `skill`)
- `default` (optional, boolean) marks a leaf as pre-highlighted in the family picker — `wizard <family>` → Enter runs the marked leaf

Failures throw at build time, before drift can ship to the wizard.

**Flat vs. family rule:** a public command is flat when there's only one option
today, a family when the user must pick. Don't pre-create `wizard migrate
<vendor>` while there's only one vendor — restructure to a family when a second
lands. See [CONTRIBUTING.md § Flat vs. family](CONTRIBUTING.md#flat-vs-family--the-convention).

### When you're about to change a `cli:` block

1. Read [CONTRIBUTING.md § Promotion criterion for `role: command`](CONTRIBUTING.md#promotion-criterion-for-role-command).
2. Run `npm test` — the parser's suite (`scripts/lib/tests/cli-block.test.js`) covers every naming-convention case.
3. Run `npm run build` — confirm the entry appears (or disappears) under `cliEntries` in `dist/skills/skill-menu.json` with the values you expect.
4. The wizard resolves new entries at runtime, so no wizard release is required unless the change needs wizard-side hooks (custom outro, content blocks, abort cases).
5. **Flag the wizard maintainer:** the wizard ships a committed `docs/cli.md` auto-generated from the manifest. When the wizard upgrades to a release containing your change, someone needs to run `pnpm docs:cli` over there to refresh it. Note this in your PR description or open a tracking issue in the wizard repo.

## Wizard CLI command mapping (old → new)

The wizard CLI was overhauled. Use the new command names. Old names mostly no
longer exist — only some keep an alias.

| Old command | New command | Status |
|---|---|---|
| `wizard integrate` | `wizard` (default flow) | command removed |
| `wizard events-audit` | `wizard audit events` | moved into `audit` family |
| `wizard audit` (single) | `wizard audit [skill]` | now a family; `audit all` = comprehensive |
| `wizard audit-3000` | *removed* | retired |
| `wizard revenue` | `wizard revenue-analytics` | renamed (old `revenue` removed) |
| `wizard upload-sourcemaps` | `wizard upload-source-maps` | renamed; `upload-sourcemaps` kept as alias |

**Commands vs. programs:** a command is the word a user types; a program is the
internal logic behind it. `posthog-integration` is a *program id, not a command*
— it powers the default flow. Don't reference it as a CLI command.

When you rename a command, update this table. A rename is a breaking change for
users — keep the old name working as an alias only when external callers (users'
scripts) may still use it; when the only caller is one we control, update the
caller instead.

## Commands

```bash
npm install        # Install dependencies
npm test           # vitest run (parsers, expander, plugins, cli block)
npm run build      # Full build: emits dist/skills/<id>.zip + manifests
npm run dev        # Partial-rebuild dev server with watch
```

## Repository conventions

- Skill content lives in markdown, never in JS/TS. The build pipeline reads YAML configs and stitches markdown together; it doesn't generate prose.
- The `cli:` block is the **single source of truth** for the wizard's command surface for any skill. Don't duplicate command names in the wizard repo; they're derived from the manifest.
- `additionalProperties: false` is set on the JSON Schema — adding a new field to the manifest shape is a coordinated change (bump the schema, bump consumer types in the wizard). See [PostHog/wizard CONTRIBUTING.md](https://github.com/PostHog/wizard/blob/main/CONTRIBUTING.md) for the wizard-side contract.

## Companion projects

- **[wizard](https://github.com/PostHog/wizard)** — the CLI that consumes the manifest at build time and turns each `role: command` entry into a registered command.
- **[warlock](https://github.com/PostHog/warlock)** — the security scanner used by the wizard. Unrelated to skill content but lives alongside in the same engineering scope.
