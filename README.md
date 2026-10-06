# Welcome to the PostHog context mill

This repo assembles PostHog context for AI agents and LLMs into [Agent Skills](https://agentskills.io/specification)-compliant packages. Check out `/context` for details. 

**Need output in a different format?** No problem. Let us know in [#team-docs-and-wizard](https://posthog.slack.com/archives/C09GTQY5RLZ), or fire up a PR to augment the `/context` and `/scripts` directories with your preferred transformation.

**Have a skill you want to make sure is maintained and distributed via the wizard?** 

We'd love your pull request!

The context mill gathers up-to-date content from multiple sources, packaging PostHog developer docs, prompts, and working example code into a versioned manifest which can be shipped anywhere as a zip file. 

The [PostHog MCP server](https://github.com/PostHog/posthog/tree/master/services/mcp) currently fetches the examples repo manifest and exposes it to any MCP-compatible client as resources and slash commands. The PostHog [wizard](https://github.com/PostHog/wizard) fetches `skill-menu.json` and skill ZIPs from the context mill's GitHub releases itself. It falls back to the AWS mirror at `context-mill.posthog.com` when GitHub fails.

## Context engine 

![context engine diagram](https://res.cloudinary.com/dmukukwp6/image/upload/q_auto,f_auto/context_engine_29f6d6ddc0.png)

The examples repo effectively acts as a context engine, an assembly line for turning disparate PostHog knowledge into something portable, something AI systems can reliably consume. 

You can break its context engineering flow into three main stages.

**1. Context sourcing**: The examples repo pulls from the entire PostHog developer docs, with pages delivered from posthog.com as raw Markdown. It also includes curated, hand-crafted prompts and working example apps.

**2. Context assembly**: The examples repo transforms and packages the sourced context into a zip file manifest, which is meant to be portable and self-contained. We can structure and shape the manifest however we need.

**3. Context delivery**: The examples repo creates a versioned release for the manifest, which can be consumed by any agent or MCP server as a skill or resource.

## Example apps

We've got live, working example code that demonstrates PostHog in action. You can run these yourself to see events flow into your PostHog project.

## Example apps are not production-grade

These are more like model airplanes. They're dramatically simplified to make it easy to see PostHog in action. You shouldn't use these as starter projects or put them into production. The authentication is fake!

But the leanness makes these useful for agent-driven development. Use these as context to help your agent make better integration decisions about PostHog.

```
context-mill/
├── context/                     # Skill sources, agent prompts, and build config
├── example-apps/                # One flat folder per example app
│   ├── next-app-router/         # Next.js with App Router
│   ├── next-pages-router/       # Next.js with Pages Router
│   ├── react-react-router-7-framework/     # React with React Router 7 (framework mode)
│   ├── react-tanstack-router-file-based/   # React with TanStack Router (file-based)
│   ├── react-tanstack-router-code-based/   # React with TanStack Router (code-based)
│   ├── tanstack-start/          # TanStack Start
│   ├── django/                  # Django
│   └── ...                      # Every other example app
└── scripts/                     # Build scripts
```

## Build outputs

Run `pnpm run build` to generate the release artifacts:

| Output | Description |
|--------|-------------|
| `dist/skills/<id>.zip` | Per-skill bundles (SKILL.md + references + shared docs) |
| `dist/skills/manifest.json` | Versioned manifest of every bundled skill and its download URL |
| `dist/skills/skill-menu.json` | Category groupings and `cliEntries` — the wizard's command lookup table |
| `dist/skills/<group>.json` | One file per bundled group (`packaging: bundle`), holding every variant |
| `dist/skills-mcp-resources.zip` | `manifest.json` plus every skill ZIP and bundle JSON in one archive |

Releases are cut as GitHub releases and mirrored to `context-mill.posthog.com`.
Each release carries these assets:

- `skills-mcp-resources.zip`, which holds `manifest.json`, the skill ZIPs, and the bundle JSONs
- one ZIP per skill
- `skill-menu.json`
- one `<group>.json` per bundled group
- `agent-menu.json` and the `agents-*.md` orchestrator prompts
- any reference docs (`*.md`) in `dist/skills/`

`manifest.json` is not a standalone release asset. It only ships inside
`skills-mcp-resources.zip`. The wizard fetches `skill-menu.json` from the
latest release and downloads skill ZIPs or bundle JSONs on demand.

### Manifest structure

The manifest describes the built skills — one resource per skill, with `id`,
`name`, `description`, `tags`, `uri`, and a `downloadUrl` pointing at the
GitHub release asset. Bundled variants (`packaging: bundle`) ship inside their
group's JSON, so they have no manifest entry. The manifest also has one
resource per doc in `context/docs.yaml`, with the doc's Markdown inline
instead of a `downloadUrl`. Each bundled skill contains a `SKILL.md`, `references/`
step files, and any shared docs pulled from posthog.com at build time.

### Adding a new skill

Add numbered step files to `context/skills/<skill>/references/` using the
convention `<n>-<name>.md` with `next_step:` frontmatter pointing to the next
file. The build script discovers, orders, and bundles them automatically.

## Wizard CLI commands

Skills in this repo declare how they surface as wizard commands via a `cli:`
block in their `config.yaml`. That mechanism — `role`, `parentCommand`,
`command`, flat vs. family — is documented in
[`CONTRIBUTING.md`](CONTRIBUTING.md#how-skills-get-into-the-wizard-cli).

The CLI was overhauled to consolidate commands into a smaller, extensible
surface. If you (or your agent) knew an older command, here's where it went:

| Old command | New command | What changed |
|---|---|---|
| `wizard integrate` | `wizard` (default flow) | Command removed; the default flow runs the integration |
| `wizard events-audit` | `wizard audit events` | Now an `audit`-family subcommand |
| `wizard audit` (single audit) | `wizard audit <subcommand>` | Now a family — see the audit subcommands below |
| `wizard audit-3000` | *removed* | Retired |
| `wizard revenue` | `wizard revenue-analytics` | Renamed (old `revenue` removed) |
| `wizard upload-sourcemaps` | `wizard upload-source-maps` | Renamed; `upload-sourcemaps` still works as an alias |

### Audit subcommands (and the skills behind them)

`audit` is the one family today whose subcommands are skills from this repo:

| Subcommand | Backing skill |
|---|---|
| `wizard audit events` | `audit-events` |
| `wizard audit all` | `audit` (the default leaf) |
| `wizard audit attribution` | `audit-attribution` |
| `wizard audit autocapture` | `audit-autocapture` |
| `wizard audit feature-flags` | `audit-feature-flags` |
| `wizard audit identify` | `audit-identify` |
| `wizard audit session-replay` | `audit-session-replay` |
| `wizard audit web-analytics` | *(wizard-native, not a skill in this repo)* |

> **Commands vs. skills:** those audit subcommands **are** skills, promoted to
> commands via `cli: role: command`. A skill with `role: skill` is reachable only
> through `wizard skill <id>`. Same machinery, two surfaces — so
> `wizard audit <subcommand>` picks an audit area, it does **not** take a skill
> name.

> **Commands vs. programs:** `integrate` was the *command*; the program behind it
> is `posthog-integration`, which still exists and powers the default flow. The
> program id is internal — it was never a command you typed.

## Context mill skill owners

Reviews are auto-requested via [`.github/CODEOWNERS`](.github/CODEOWNERS) — the
file is the source of truth; this table just mirrors it for readability.
`team-wizard-docs` is the default reviewer; the team-owned skills below route
review to their owning team instead.

| Path | Owning team |
|---|---|
| `*` (everything else, including all other skills) | `@PostHog/team-wizard-docs` |
| `context/skills/error-tracking-upload-source-maps/` | `@PostHog/team-error-tracking` |
| `context/skills/error-tracking-link-releases/` | `@PostHog/team-error-tracking` |
| `context/skills/self-driving/` | `@PostHog/team-self-driving` |
| `context/skills/data-warehouse-source/` | `@PostHog/team-warehouse-sources` |
| `context/skills/mcp-analytics/` | `@PostHog/team-mcp-analytics` |
| `context/skills/metrics/` | `@PostHog/apm` |
| `context/agents/metrics/` | `@PostHog/apm` |
| `context/skills/revenue-analytics/` | `@PostHog/team-web-analytics` |
| `context/skills/web-analytics/` | `@PostHog/team-web-analytics` |
| `context/skills/integration/` | `@PostHog/team-wizard-docs` |
| `context/skills/replay-vision*/` | `@PostHog/team-replay` |
| `context/skills/ai-observability/` | `@PostHog/team-ai-observability` |
| `context/skills/llm-analytics/` | `@PostHog/team-ai-observability` |

Ownership is by directory. Skills not listed above (`audit`, `audit-*`,
`creating-product-tours`, `error-tracking`, `events-audit`, `feature-flags`,
`integration-v2`, `logs`, `migrate`, `omnibus`, `posthog-best-practices`,
`quack`, `tools-and-features`, `tracing`) fall through the
default and are owned by `team-wizard-docs`. Today CODEOWNERS only
auto-requests review — approval is not a merge gate.

## Security scanning

Before we ship any skills, we run them through [the warlock](https://github.com/PostHog/warlock), PostHog's security scanner for agentic flows. It reads the built skill bundles and looks for prompt-injection attempts and other risky content that could trick an agent downstream. An LLM triage pass then sorts the real threats from the false positives, so we're not chasing noise.

CI runs this automatically on every build and release, so most of the time you don't have to think about it. But if you want to check something locally:

```
pnpm security-scan:skills            # scan all built skill ZIPs (this is what CI runs)
pnpm security-scan path/to/file.md   # scan a specific file
```

Heads up, the skills scan reads from `dist/`, so run `pnpm build` first. If a scan flags something, fix the flagged content before releasing :)
