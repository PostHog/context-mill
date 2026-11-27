import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertSubscriptionInit,
  buildScopedSdkMcpServer,
  createClaudeSdkExecutor,
  inspectSettingsConflicts,
  jsonSchemaToZodShape,
  sanitizeSubscriptionEnv,
  verifyLocalSubscriptionAuth,
} from '../runtime/claude-sdk-adapter.mjs';
import { createToolCatalog } from '../tools/catalog.mjs';

function makeFakeZod() {
  const mk = type => {
    const node = {
      _type: type,
      optional: () => ({ ...node, _optional: true }),
      int: () => ({ ...node, _int: true }),
      describe: desc => ({ ...node, _description: desc }),
    };
    return node;
  };
  return {
    string: () => mk('string'),
    number: () => mk('number'),
    boolean: () => mk('boolean'),
    any: () => mk('any'),
    enum: vals => ({ ...mk('enum'), _enum: vals }),
    array: item => ({ ...mk('array'), _item: item }),
    object: shape => ({ ...mk('object'), _shape: shape }),
    record: (_k, v) => ({ ...mk('record'), _value: v }),
  };
}

describe('claude-sdk-adapter subscription guards & scoped MCP bindings', () => {
  it('strips paid API keys and cloud provider overrides from env and disables auto-memory', () => {
    const env = sanitizeSubscriptionEnv({
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'sk-ant-secret',
      ANTHROPIC_BASE_URL: 'https://proxy.example',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'tok',
      HOME: '/tmp/home',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/tmp/home');
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBeUndefined();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
    expect(env.CLAUDE_CODE_DISABLE_AUTO_MEMORY).toBe('1');
    expect(env.CLAUDE_CODE_DISABLE_CLAUDE_MDS).toBe('1');
  });

  it('detects paid overrides in Claude settings and ~/.claude.json', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'claude-sdk-settings-'));
    try {
      mkdirSync(join(tmp, '.claude'), { recursive: true });
      writeFileSync(
        join(tmp, '.claude', 'settings.json'),
        JSON.stringify({ apiKeyHelper: '/bin/key', env: { ANTHROPIC_API_KEY: 'sk-123' } })
      );
      writeFileSync(join(tmp, '.claude.json'), JSON.stringify({ primaryApiKey: 'sk-456' }));
      const res = inspectSettingsConflicts({ homeDir: tmp, cwd: tmp, env: {} });
      expect(res.conflicts.length).toBeGreaterThanOrEqual(3);
      expect(res.conflicts.some(c => c.includes('apiKeyHelper'))).toBe(true);
      expect(res.conflicts.some(c => c.includes('ANTHROPIC_API_KEY'))).toBe(true);
      expect(res.conflicts.some(c => c.includes('primaryApiKey'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('verifies claude.ai firstParty subscription auth and rejects paid or non-firstParty auth', () => {
    const ok = verifyLocalSubscriptionAuth({
      authCheckFn: () => ({
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        subscriptionType: 'team',
        apiKeySource: 'none',
      }),
    });
    expect(ok.subscriptionType).toBe('team');

    expect(() =>
      verifyLocalSubscriptionAuth({
        authCheckFn: () => ({
          loggedIn: true,
          authMethod: 'apiKey',
          apiProvider: 'firstParty',
          subscriptionType: 'team',
        }),
      })
    ).toThrow(/authMethod/);

    expect(() =>
      assertSubscriptionInit({ apiKeySource: 'env' }, { conflicts: [] })
    ).toThrow(/non-subscription apiKeySource/);

    expect(() =>
      assertSubscriptionInit({ apiKeySource: 'none' }, { conflicts: [] }, null)
    ).toThrow(/requires proven firstParty subscriptionType/);

    expect(() =>
      assertSubscriptionInit(
        { apiKeySource: 'none' },
        { conflicts: [] },
        { apiProvider: 'firstParty', subscriptionType: 'team', apiKeySource: 'none' }
      )
    ).not.toThrow();
  });

  it('converts catalog JSON schemas into Zod shapes and scopes MCP tools strictly to step.tools', async () => {
    const z = makeFakeZod();
    const shape = jsonSchemaToZodShape(
      {
        type: 'object',
        required: ['def_id'],
        properties: {
          def_id: { type: 'string', description: 'Definition ID' },
          limit: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      z
    );
    expect(shape.def_id._type).toBe('string');
    expect(shape.def_id._optional).toBeUndefined();
    expect(shape.limit._type).toBe('number');
    expect(shape.limit._optional).toBe(true);
    expect(shape.tags._type).toBe('array');

    const catalog = createToolCatalog(() => ({
      facts: [{ code: 'MCPA-TS-F-000001', def: 'posthog-js:a.ts#fn', claim: 'Does X' }],
    }));

    const createdTools = [];
    const { server, boundTools } = buildScopedSdkMcpServer({
      step: {
        id: 'judge-replay-events',
        tools: ['query_fact'],
        mcpServers: ['docs-ia-tools'],
      },
      toolCatalog: catalog,
      createSdkMcpServer: cfg => cfg,
      tool: (name, description, zodShape, handler) => {
        const entry = { name, description, zodShape, handler };
        createdTools.push(entry);
        return entry;
      },
      z,
    });

    expect(boundTools).toEqual(['query_fact']);
    expect(server.name).toBe('docs-ia-tools');
    expect(createdTools).toHaveLength(1);
    const res = await createdTools[0].handler({ code: 'MCPA-TS-F-000001' });
    expect(res.content[0].text).toContain('MCPA-TS-F-000001');
  });

  it('executes a workflow agent step via Claude Agent SDK adapter with subscription check and tool fence', async () => {
    const z = makeFakeZod();
    const catalog = createToolCatalog(() => ({
      facts: [{ code: 'MCPA-TS-F-000001', def: 'posthog-js:a.ts#fn', claim: 'Does X' }],
    }));

    let capturedOptions = null;
    const executor = createClaudeSdkExecutor({
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      authCheckFn: () => ({
        loggedIn: true,
        authMethod: 'claude.ai',
        apiProvider: 'firstParty',
        subscriptionType: 'team',
      }),
      settingsCheckFn: () => ({ conflicts: [] }),
      sdkLoader: async () => ({
        z,
        tool: (name, description, shape, handler) => ({ name, description, shape, handler }),
        createSdkMcpServer: cfg => cfg,
        query: ({ options }) => {
          capturedOptions = options;
          const gen = (async function* () {
            yield { type: 'system', subtype: 'init', apiKeySource: 'none', model: options.model };
            yield {
              type: 'assistant',
              message: {
                content: [
                  { type: 'tool_use', name: 'mcp__docs-ia-tools__query_fact', input: { code: 'MCPA-TS-F-000001' } },
                ],
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              session_id: 'sess-1',
              num_turns: 2,
              total_cost_usd: 0.01,
              usage: { input_tokens: 100, output_tokens: 50 },
              result: '{"ok": true}',
            };
          })();
          gen.accountInfo = async () => ({
            apiProvider: 'firstParty',
            subscriptionType: 'team',
            apiKeySource: 'none',
          });
          return gen;
        },
      }),
    });

    const out = await executor({
      step: {
        id: 'judge-step',
        model: 'gemini-4-neon',
        effort: 'medium',
        tools: ['query_fact'],
        mcpServers: ['docs-ia-tools'],
      },
      promptText: 'Test prompt',
      tools: catalog,
    });

    expect(out.provider).toBe('claude-sdk');
    expect(out.model).toBe('claude-sonnet-5-5');
    expect(out.data).toEqual({ ok: true });
    expect(out.boundTools).toEqual(['query_fact']);
    expect(out.toolCallsByName['mcp__docs-ia-tools__query_fact']).toBe(1);

    // Verify canUseTool denies unbound tools and allows bound tools
    const allowed = await capturedOptions.canUseTool('mcp__docs-ia-tools__query_fact', { code: 'X' });
    expect(allowed.behavior).toBe('allow');
    const deniedMcp = await capturedOptions.canUseTool('mcp__docs-ia-tools__assign_dewey_codes', {});
    expect(deniedMcp.behavior).toBe('deny');
    const deniedBash = await capturedOptions.canUseTool('Bash', { command: 'ls' });
    expect(deniedBash.behavior).toBe('deny');
  });
});
