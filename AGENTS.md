# AGENTS.md — PostHog context mill

Guidance for AI agents working in this repo. See [`README.md`](README.md) for the
overview, [`CONTRIBUTING.md`](CONTRIBUTING.md) for how skills are built and how
they surface as wizard commands, and `CLAUDE.md` for repo conventions.

## How skills become wizard commands

Each skill's `config.yaml` may carry a `cli:` block that declares the wizard
command it backs (`role`, `parentCommand`, `command`). The block is compiled into
`cliEntries` in `dist/skills/skill-menu.json`, which the wizard fetches at
runtime. **Adding or renaming a skill-backed command is a context-mill release —
no wizard code change.** Full schema and the flat-vs-family rules are in
[`CONTRIBUTING.md`](CONTRIBUTING.md#how-skills-get-into-the-wizard-cli).

## Wizard CLI command mapping (old → new)

The CLI was overhauled. Use the new command names. Old names mostly no longer
exist — only two are kept as aliases.

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
— it powers the default flow and is a dependency of other programs. Don't
reference it as a CLI command.

## When you add or change a command

1. Edit the skill's `config.yaml` `cli:` block (not wizard code).
2. If you rename a command, update this table and the one in
   [`README.md`](README.md) so both stay in sync.
3. A rename is a breaking change for users. Keep the old name working as an
   alias only when external callers (users' scripts) may still use it — the
   wizard does this for `upload-sourcemaps`. When the only caller is one we
   control, update the caller instead of carrying an alias.
