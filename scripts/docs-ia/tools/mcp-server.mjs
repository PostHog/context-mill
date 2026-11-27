// Scoped stdio JSON-RPC 2.0 MCP server for Docs IA agent steps.
//
// Exposes ONLY the exact `allowedTools` declared in a workflow step's config binding.
// Supports `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`.
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createToolCatalog } from './catalog.mjs';

export function createMcpDispatcher({ catalog, allowedTools = null }) {
  const allow = Array.isArray(allowedTools) ? [...allowedTools] : null;
  for (const name of allow || []) {
    if (!catalog.has(name)) {
      throw new Error(`Cannot bind unknown tool "${name}" to MCP server`);
    }
  }

  return async function dispatch(message) {
    const { id = null, method, params = {} } = message || {};

    if (method === 'notifications/initialized') {
      return null;
    }

    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'docs-ia-tools', version: '1.0.0' },
        },
      };
    }

    if (method === 'tools/list') {
      const tools = catalog.list(allow).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      return { jsonrpc: '2.0', id, result: { tools } };
    }

    if (method === 'tools/call') {
      const { name, arguments: toolArgs = {} } = params;
      try {
        const result = await catalog.invoke(name, toolArgs, allow);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            isError: true,
            content: [{ type: 'text', text: String(err?.message || err) }],
          },
        };
      }
    }

    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  };
}

/** Run as a standalone stdio MCP process (spawned by `runtime/agent-adapter.mjs` or `cli.mjs mcp-serve`). */
export function startStdioMcpServer({ statePath = null, allowedTools = null } = {}) {
  const rawState = statePath ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  const defsById = new Map((rawState.defs || []).map(d => [d.id, d]));
  const state = { ...rawState, defsById };
  const catalog = createToolCatalog(() => state);
  const dispatch = createMcpDispatcher({ catalog, allowedTools });

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', async line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let req;
    try {
      req = JSON.parse(trimmed);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`);
      return;
    }
    const resp = await dispatch(req);
    if (resp) process.stdout.write(`${JSON.stringify(resp)}\n`);
  });
}
