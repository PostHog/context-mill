# context-mill

This repo packages PostHog's developer content (docs, prompts, example
code) into [Agent Skills](https://agentskills.io/specification)-compliant
skill packages. The build pipeline emits a versioned manifest plus per-skill
ZIPs, consumed by the PostHog [wizard](https://github.com/PostHog/wizard)
and the PostHog [MCP server](https://github.com/PostHog/posthog/tree/master/products/mcp).

User-facing intro: [README.md](README.md). Contributor handbook:
[CONTRIBUTING.md](CONTRIBUTING.md).

## What lives where

| Concern | Where |
|---|---|
| Skill source content | `transformation-config/skills/<name>/` |
| Skill descriptor / surface declarations | `transformation-config/skills/<name>/config.yaml` |
| Build pipeline | `scripts/lib/` (skill generator, build phases, change router) |
| Build entrypoints | `scripts/build.js` (full) and `scripts/dev-server.js` (partial / watch) |
| Tests | `scripts/lib/tests/` and `scripts/plugins/tests/` (vitest) |
| Manifest output | `dist/skills/manifest.json`, `dist/skills/cli-manifest.json`, `dist/skills/skill-menu.json` |
| Per-skill ZIPs | `dist/skills/<id>.zip` |
| JSON Schema for the CLI manifest | `transformation-config/cli-manifest.schema.json` → copied to `dist/skills/` on every build |

## The `cli:` block (read [CONTRIBUTING.md](CONTRIBUTING.md) before editing)

Every skill's `config.yaml` may declare an optional `cli:` block that tells
the wizard whether and how to expose the skill as a CLI command. The full
schema, the YAML→command mapping table, and the promotion criterion for
`surface: public` live in [CONTRIBUTING.md](CONTRIBUTING.md). Quick shape:

```yaml
cli:
  surface: public        # public | catalog | internal
  parentCommand: audit   # optional — nests this command under another
  command: events        # the user-typed word; required when public
```

The parser is `parseCliBlock` in `scripts/lib/skill-generator.js`. It
enforces:

- `surface` is one of `public`, `catalog`, `internal` (default: `catalog`
  if no `cli:` block is set at all)
- `command` and `parentCommand` are kebab-case, 2–20 characters
- Neither field is a yargs reserved word (`help`, `version`, `completion`)
  or a wizard internal flag (`playground`, `benchmark`, `yara-report`,
  `local-mcp`, `ci`, `skill`)

Failures throw at build time, before drift can ship to the wizard.

## When you're about to change a `cli:` block

1. Read [CONTRIBUTING.md § Promotion criterion for `surface: public`](CONTRIBUTING.md#promotion-criterion-for-surface-public).
2. Run `npm test` — the parser's test suite (`scripts/lib/tests/cli-block.test.js`)
   covers every naming-convention case.
3. Run `npm run build` — confirm the entry appears (or disappears) in
   `dist/skills/cli-manifest.json` with the values you expect.
4. The wizard's next release picks up the change automatically. No wizard
   PR needed unless the change requires wizard-side hooks (custom outro,
   content blocks, abort cases).

## Commands

```bash
npm install        # Install dependencies
npm test           # vitest run (parsers, expander, plugins, cli block)
npm run build      # Full build: emits dist/skills/<id>.zip + manifests
npm run dev        # Partial-rebuild dev server with watch
```

## Repository conventions

- Skill content lives in markdown, never in JS/TS. The build pipeline reads
  YAML configs and stitches markdown together; it doesn't generate prose.
- The `cli:` block is the **single source of truth** for the wizard's
  public CLI surface for any skill. Don't duplicate command names in the
  wizard repo; they're derived from the manifest.
- `additionalProperties: false` is set on the JSON Schema — adding a new
  field to the manifest shape is a coordinated change (bump the schema,
  bump consumer types in the wizard). See
  [PostHog/wizard CONTRIBUTING.md](https://github.com/PostHog/wizard/blob/main/CONTRIBUTING.md)
  for the wizard-side contract.

## Companion projects

- **[wizard](https://github.com/PostHog/wizard)** — the CLI that consumes
  the manifest at build time and turns each `surface: public` entry into a
  registered command.
- **[warlock](https://github.com/PostHog/warlock)** — the security scanner
  used by the wizard. Unrelated to skill content but lives alongside in
  the same engineering scope.
