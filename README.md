# Welcome to the PostHog context mill

This repo assembles PostHog context for AI agents and LLMs into [Agent Skills](https://agentskills.io/specification)-compliant packages. Check out `/transformation-config` for details. **Need output in a different format?** No problem. Let us know in [#team-docs-and-wizard](https://posthog.slack.com/archives/C09GTQY5RLZ), or fire up a PR to augment the `/transformation-config` and `/scripts` directories with your preferred transformation.

**Have a skill you want to make sure is maintained and distributed via the PostHog MCP?** We'd love your pull request!

The context mill gathers up-to-date content from multiple sources, packaging PostHog developer docs, prompts, and working example code into a versioned manifest, which can be shipped anywhere as a zip file. 

The [PostHog MCP server](https://github.com/PostHog/posthog/tree/master/products/mcp) currently fetches the examples repo manifest and exposes it to any MCP-compatible client as resources and slash commands. This is what currently powers the PostHog [wizard](https://github.com/PostHog/wizard). 

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
examples/
├── basics/
│   ├── next-app-router/         # Next.js 15 with App Router
│   ├── next-pages-router/       # Next.js 15 with Pages Router
│   ├── react-react-router/      # React with React Router
│   ├── react-tanstack-router-file-based/   # React with TanStack Router (file-based)
│   ├── react-tanstack-router-code-based/   # React with TanStack Router (code-based)
│   ├── tanstack-start/          # TanStack Start
│   └── django/                  # Django
├── llm-prompts/                 # Workflow guides for AI agents
├── mcp-commands/                # MCP command prompts (`/command` in agents, can wrap `llm-prompts`)
└── scripts/                     # Build scripts
```

## MCP resources

This repository serves as the **single source of truth** for PostHog integration resources accessed via the [PostHog MCP server](https://github.com/PostHog/posthog/tree/master/services/mcp).

### Build outputs

Run `npm run build:docs` to generate:

| Output | Description |
|--------|-------------|
| `dist/*.md` | Example projects converted to markdown |
| `dist/manifest.json` | Resource URIs and metadata |
| `dist/examples-mcp-resources.zip` | Complete archive for MCP server |

### Manifest structure

The manifest defines:
- **Workflows**: Step-by-step guides with automatic next-step linking
- **Docs**: PostHog documentation URLs (fetched at runtime)
- **Prompts**: MCP command prompts with template variable substitution
- **Templates**: Resource templates for parameterized access (e.g., `posthog://examples/{framework}`)

### Adding new resources

**Workflows**: Add markdown files to `llm-prompts/[category]/` following the naming convention `[order].[step]-[name].md`

**Examples**: Add new example projects to `basics/` and configure in `scripts/build-examples-mcp-resources.js`

**Prompts**: Add JSON files to `mcp-commands/`

The build script automatically discovers, orders, and generates URIs for all resources.

### Architecture

- **Single source of truth**: All URIs defined in this repo
- **Zero hardcoding**: MCP server purely reflects the manifest for `resources` and `prompts` (as defined in the MCP [spec](https://modelcontextprotocol.io/specification/2025-11-25#features))
- **Easy to extend**: Add resources by creating properly named files
- **Version controlled**: Resources evolve with the examples

See `llm-prompts/README.md` for detailed workflow conventions.
