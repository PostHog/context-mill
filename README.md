# Welcome to the PostHog example collection

We've got live, working example code that demonstrates PostHog in action. You can run these yourself to see events flow into your PostHog project.

## Example apps are not production-grade

These are more like model airplanes. They're dramatically simplified to make it easy to see PostHog in action. You shouldn't use these as starter projects or put them into production. The authentication is fake!

But the leanness makes these useful for agent-driven development. Use these as context to help your agent make better integration decisions about PostHog.

## Contents

```
examples/
├── basics/
│   ├── next-app-router/         # Next.js 15 with App Router
│   ├── next-pages-router/       # Next.js 15 with Pages Router
│   ├── react-react-router/      # React with React Router
│   ├── react-tanstack-router/   # React with TanStack Router
│   └── tanstack-start/          # TanStack Start
├── llm-prompts/                 # Workflow guides for AI agents
├── mcp-commands/                # MCP command prompts (`/command` in agents, can wrap `llm-prompts`)
└── scripts/                     # Build scripts
```

## Examples

### basics/next-app-router

Next.js 15 with App Router demonstrating:
- Client-side and server-side PostHog initialization
- User identification and authentication
- Event tracking (login, logout, custom events)
- Error tracking with `posthog.captureException()`
- Reverse proxy setup for PostHog ingestion
- Session replay (automatic)

### basics/next-pages-router

Same functionality as App Router example, using Pages Router patterns.

### basics/react-react-router

React SPA with React Router demonstrating PostHog integration in a client-side app.

### basics/react-tanstack-router

React SPA with TanStack Router demonstrating PostHog integration with file-based routing.

### basics/tanstack-start

Full-stack TanStack Start app with PostHog integration.

## MCP resources

This repository serves as the **single source of truth** for PostHog integration resources accessed via the [PostHog MCP server](https://github.com/PostHog/posthog/tree/master/products/mcp).

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
