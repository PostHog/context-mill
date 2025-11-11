# LLM Prompts

This directory contains LLM workflow prompts that guide AI agents through various PostHog integration tasks.

Feel free to try these out directly, or summon them from the PostHog MCP server. You can also use them as a starting point for your own deep integrations. We've tested these extensively.

## Structure

- **basic-integration/**: Step-by-step workflow guides for adding PostHog event tracking to a project
  - `1.0-event-setup-begin.md`: Initial project analysis and event planning
  - `1.1-event-setup-edit.md`: Implementation guidance for adding PostHog tracking
  - `1.2-event-setup-revise.md`: Error checking and correction

## Build Process

These prompts are packaged into the release artifact `examples-mcp-resources.zip`.

## Usage

The MCP server fetches these prompts from the latest GitHub release and serves them as resources to AI agents and the PostHog wizard during integration tasks.