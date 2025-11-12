# LLM Prompts

This directory contains LLM workflow prompts that guide AI agents through various PostHog integration tasks.

Feel free to try these out directly, or summon them from the PostHog MCP server. You can also use them as a starting point for your own deep integrations. We've tested these extensively.

## Structure

- **basic-integration/**: Step-by-step workflow guides for adding PostHog event tracking to a project
  - `1.0-event-setup-begin.md`: Initial project analysis and event planning
  - `1.1-event-setup-edit.md`: Implementation guidance for adding PostHog tracking
  - `1.2-event-setup-revise.md`: Error checking and correction

## Manifest-Driven Architecture

These prompts and their URIs are defined in `manifest.json`, which is generated during the build process. The manifest is the **source of truth** for all resource URIs and metadata.

### How It Works

1. **Build time**: `scripts/build-examples-mcp-resources.js` generates:
   - `manifest.json` with all resource definitions and URIs
   - Packaged into `examples-mcp-resources.zip`

2. **Runtime**: The MCP server:
   - Fetches the ZIP from GitHub releases
   - Loads `manifest.json`
   - **Purely reflects** the manifest - no URI generation, just registration

### Manifest Structure

The manifest includes:
- **Workflows**: Ordered sequence with `nextStepUri` for automatic linking
- **Examples**: Pre-expanded list of framework-specific examples
- **URIs**: Fully generated at build time (e.g., `posthog://workflows/basic-integration-begin`)

### File Conventions

**Naming:** `[order].[step]-[name].md`

Examples:
- `1.0-event-setup-begin.md` → Order 1.0, step 0, ID: `basic-integration-event-setup-begin`
- `1.1-event-setup-edit.md` → Order 1.1, step 1, ID: `basic-integration-event-setup-edit`
- `2.0-analytics-setup.md` → Order 2.0, step 0, ID: `category-analytics-setup`

**Required Frontmatter:**

Every workflow file MUST include YAML frontmatter with `title` and `description`:

```markdown
---
title: Event Setup - Begin
description: Start the event tracking setup process by analyzing the project
---

Your workflow content here...
```

The build will fail if frontmatter is missing or incomplete.

**Automatic features:**
- **Next step**: Automatically linked to the next file in numerical order
- **URI generation**: `posthog://workflows/[category]-[name]`

### Adding New Workflows

1. Create a new category directory: `llm-prompts/[category]/`
2. Add markdown files following the naming convention
3. Files are automatically:
   - Discovered and ordered
   - Linked to next steps
   - Given URIs (e.g., `posthog://workflows/[category]-[name]`)
   - Added to the manifest

**No configuration needed!** Just add properly named files.

## Build Process

These prompts are packaged into the release artifact `examples-mcp-resources.zip`.

```bash
npm run build:docs
```

## Usage

The MCP server fetches these prompts from the latest GitHub release and serves them as resources to AI agents and the PostHog wizard during integration tasks.

## Architecture Benefits

- **Single source of truth**: Examples repo controls all URIs
- **No hardcoded URIs in MCP**: MCP purely reflects manifest
- **Easy to extend**: Add resources by updating manifest config
- **Version controlled**: URIs and metadata evolve with the examples
