// Co-located agent execution adapter for Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
// using local Claude subscription credentials (strictly refusing paid API key overrides).
//
// Reads a workflow `agentStep`'s declared `tools` and `mcpServers`, converts ONLY the step's
// allowlisted deterministic tools from `tools/catalog.mjs` into an in-process SDK MCP server
// (`docs-ia-tools`), and runs `query()` with local subscription guards.
//
// Zero-dep safe: dynamically resolves `@anthropic-ai/claude-agent-sdk` and `zod` only when
// executing live runs (or via injectable `sdkLoader` / `queryFn` in unit tests).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_CLAUDE_SDK_MODEL = 'claude-sonnet-5-5';
export const DEFAULT_CLAUDE_SDK_EFFORT = 'medium';
export const DEFAULT_CLAUDE_SDK_MAX_TURNS = 16;

const STRIPPED_SUBSCRIPTION_ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR',
  'CLAUDE_CODE_API_KEY_FILE_DESCRIPTOR',
  'ANTHROPIC_CUSTOM_HEADERS',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_GATEWAY',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'ANTHROPIC_FOUNDRY_BASE_URL',
  'ANTHROPIC_AWS_API_KEY',
  'ANTHROPIC_FOUNDRY_API_KEY',
  'ANTHROPIC_PROFILE',
  'ANTHROPIC_UNIX_SOCKET',
  'ANTHROPIC_FEDERATION_RULE_ID',
  'ANTHROPIC_ORGANIZATION_ID',
];

const ALLOWED_SUBSCRIPTION_KEY_SOURCES = new Set(['oauth', 'none']);

/** Clone env with paid API keys, proxy URLs, and cloud-provider overrides stripped. */
export function sanitizeSubscriptionEnv(env = process.env) {
  const next = { ...env };
  for (const key of STRIPPED_SUBSCRIPTION_ENV_KEYS) delete next[key];
  next.CLAUDE_CODE_DISABLE_AUTO_MEMORY = '1';
  next.CLAUDE_CODE_DISABLE_CLAUDE_MDS = '1';
  return next;
}

/** Check user, CLAUDE_CONFIG_DIR, and ancestor project Claude settings for paid API overrides. */
export function inspectSettingsConflicts({ homeDir = homedir(), cwd = process.cwd(), env = process.env } = {}) {
  const candidates = [
    ['user settings', join(homeDir, '.claude', 'settings.json')],
    ['user local settings', join(homeDir, '.claude', 'settings.local.json')],
  ];
  const cfgDir = env?.CLAUDE_CONFIG_DIR;
  if (cfgDir) {
    candidates.push(['CLAUDE_CONFIG_DIR settings', join(cfgDir, 'settings.json')]);
    candidates.push(['CLAUDE_CONFIG_DIR local settings', join(cfgDir, 'settings.local.json')]);
  }
  let cur = resolve(cwd);
  let idx = 0;
  while (true) {
    const labelPrefix = idx === 0 ? 'project' : `ancestor(${idx})`;
    candidates.push([`${labelPrefix} settings`, join(cur, '.claude', 'settings.json')]);
    candidates.push([`${labelPrefix} local settings`, join(cur, '.claude', 'settings.local.json')]);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
    idx++;
  }

  const seen = new Set();
  const conflicts = [];
  for (const [label, filePath] of candidates) {
    const abs = resolve(filePath);
    if (seen.has(abs) || !existsSync(abs)) continue;
    seen.add(abs);
    let parsed;
    try { parsed = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
    if (parsed?.apiKeyHelper) conflicts.push(`${label} sets apiKeyHelper`);
    const settingsEnv = parsed?.env ?? {};
    for (const key of STRIPPED_SUBSCRIPTION_ENV_KEYS) {
      if (settingsEnv[key]) conflicts.push(`${label} sets ${key}`);
    }
  }

  const claudeJsonPaths = [['user ~/.claude.json', join(homeDir, '.claude.json')]];
  if (cfgDir) claudeJsonPaths.push(['CLAUDE_CONFIG_DIR .claude.json', join(cfgDir, '.claude.json')]);
  for (const [label, filePath] of claudeJsonPaths) {
    const abs = resolve(filePath);
    if (seen.has(abs) || !existsSync(abs)) continue;
    seen.add(abs);
    let parsed;
    try { parsed = JSON.parse(readFileSync(abs, 'utf8')); } catch { continue; }
    if (parsed?.primaryApiKey) conflicts.push(`${label} sets primaryApiKey`);
  }

  return { conflicts };
}

/** Verify pre-flight local CLI auth is logged into a claude.ai firstParty subscription. */
export function verifyLocalSubscriptionAuth({ env = process.env, cwd = process.cwd(), cliBin = 'claude', authCheckFn } = {}) {
  let status;
  if (authCheckFn) {
    status = authCheckFn();
  } else {
    let raw = '';
    try {
      raw = execFileSync(cliBin, ['auth', 'status', '--json'], {
        cwd,
        env: sanitizeSubscriptionEnv(env),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      raw = String(err?.stdout ?? '') || String(err?.stderr ?? '');
      if (!raw.trim()) {
        throw new Error(`Unable to verify local Claude subscription auth via ${cliBin}: ${err.message}`);
      }
    }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const slice = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
    try {
      status = JSON.parse(slice);
    } catch (err) {
      throw new Error(`Invalid JSON from Claude auth status check: ${err.message}`);
    }
  }

  if (!status?.loggedIn) {
    throw new Error('Claude CLI is not logged in to a subscription; run `claude auth login` with your claude.ai account.');
  }
  if (status.authMethod !== 'claude.ai') {
    throw new Error(`Refusing Claude Agent SDK run with authMethod=${JSON.stringify(status.authMethod)}; expected claude.ai subscription.`);
  }
  if (status.apiProvider !== 'firstParty') {
    throw new Error(`Refusing Claude Agent SDK run with apiProvider=${JSON.stringify(status.apiProvider)}; expected firstParty.`);
  }
  if (!status.subscriptionType) {
    throw new Error('Refusing Claude Agent SDK run: claude.ai status missing subscriptionType.');
  }
  if (status.apiKeySource && !ALLOWED_SUBSCRIPTION_KEY_SOURCES.has(status.apiKeySource)) {
    throw new Error(`Refusing Claude Agent SDK run with paid/non-subscription apiKeySource=${JSON.stringify(status.apiKeySource)}.`);
  }
  return status;
}

/** Abort immediately unless init + accountInfo prove local claude.ai subscription with zero conflicts. */
export function assertSubscriptionInit(initMsg, settingsCheck = { conflicts: [] }, accountInfo = undefined) {
  if (settingsCheck?.conflicts?.length) {
    throw new Error(`Refusing Claude Agent SDK run due to subscription conflict: ${settingsCheck.conflicts.join('; ')}`);
  }
  const source = initMsg?.apiKeySource ?? '';
  if (!ALLOWED_SUBSCRIPTION_KEY_SOURCES.has(source)) {
    throw new Error(`Refusing Claude Agent SDK run with non-subscription apiKeySource=${JSON.stringify(source)}.`);
  }
  if (source === 'none') {
    if (
      accountInfo?.apiProvider !== 'firstParty' ||
      !accountInfo?.subscriptionType ||
      (accountInfo?.apiKeySource && accountInfo.apiKeySource !== 'none')
    ) {
      throw new Error(
        `Refusing Claude Agent SDK run: apiKeySource="none" requires proven firstParty subscriptionType via accountInfo (got ${JSON.stringify(accountInfo ?? null)}).`
      );
    }
  } else if (accountInfo) {
    if (accountInfo.apiProvider && accountInfo.apiProvider !== 'firstParty') {
      throw new Error(`Refusing Claude Agent SDK run with non-firstParty apiProvider=${JSON.stringify(accountInfo.apiProvider)}.`);
    }
    if (accountInfo.apiKeySource && accountInfo.apiKeySource !== 'oauth') {
      throw new Error(`Refusing Claude Agent SDK run with non-subscription accountInfo.apiKeySource=${JSON.stringify(accountInfo.apiKeySource)}.`);
    }
  }
}

/** Convert a declarative catalog JSON Schema (`inputSchema`) into a Zod raw shape for SDK MCP tools. */
export function jsonSchemaToZodShape(inputSchema, z) {
  const props = inputSchema?.properties || {};
  const required = new Set(inputSchema?.required || []);

  function convertProp(spec) {
    let schema;
    if (!spec || typeof spec !== 'object') {
      schema = z.any();
    } else if (spec.type === 'string') {
      schema = Array.isArray(spec.enum) && spec.enum.length > 0 ? z.enum(spec.enum) : z.string();
    } else if (spec.type === 'number') {
      schema = z.number();
    } else if (spec.type === 'integer') {
      schema = z.number().int();
    } else if (spec.type === 'boolean') {
      schema = z.boolean();
    } else if (spec.type === 'array') {
      schema = z.array(convertProp(spec.items));
    } else if (spec.type === 'object') {
      schema = spec.properties ? z.object(jsonSchemaToZodShape(spec, z)) : z.record(z.string(), z.any());
    } else {
      schema = z.any();
    }
    if (spec?.description && typeof schema.describe === 'function') {
      schema = schema.describe(spec.description);
    }
    return schema;
  }

  const shape = {};
  for (const [key, spec] of Object.entries(props)) {
    const field = convertProp(spec);
    shape[key] = required.has(key) ? field : field.optional();
  }
  return shape;
}

/**
 * Build an in-process Claude Agent SDK MCP server exposing ONLY the deterministic tools
 * listed in `step.tools` from `tools/catalog.mjs`.
 */
export function buildScopedSdkMcpServer({ step, toolCatalog, createSdkMcpServer, tool, z }) {
  const allowlist = [...(step.tools || [])];
  if (!step.mcpServers?.includes('docs-ia-tools') || allowlist.length === 0) {
    return { server: null, boundTools: [] };
  }
  const defs = toolCatalog.list(allowlist);
  const sdkTools = defs.map(def => {
    const shape = jsonSchemaToZodShape(def.inputSchema, z);
    return tool(def.name, def.description, shape, async args => {
      const out = await toolCatalog.invoke(def.name, args || {}, allowlist);
      return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
    });
  });
  const server = createSdkMcpServer({
    name: 'docs-ia-tools',
    version: '1.0.0',
    alwaysLoad: true,
    tools: sdkTools,
  });
  return { server, boundTools: defs.map(d => d.name) };
}

function extractBalancedJson(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const objs = [];
    let depth = 0;
    let start = -1;
    let inStr = false;
    let esc = false;
    for (let i = 0; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) {
          const slice = cleaned.slice(start, i + 1);
          try { objs.push({ slice, val: JSON.parse(slice) }); } catch {}
          start = -1;
        }
      }
    }
    if (!objs.length) return null;
    objs.sort((a, b) => b.slice.length - a.slice.length);
    return objs[0].val;
  }
}

async function defaultLoadClaudeSdk({ moduleSearchPaths = [] } = {}) {
  const candidates = [process.env.DOCS_IA_CLAUDE_SDK_NODE_MODULES, ...moduleSearchPaths].filter(Boolean);
  try {
    const [sdk, zodMod] = await Promise.all([
      import('@anthropic-ai/claude-agent-sdk'),
      import('zod'),
    ]);
    return {
      query: sdk.query,
      tool: sdk.tool,
      createSdkMcpServer: sdk.createSdkMcpServer,
      z: zodMod.z,
    };
  } catch {
    for (const dir of candidates) {
      try {
        const req = createRequire(join(dir, '_noop.js'));
        const sdkPath = req.resolve('@anthropic-ai/claude-agent-sdk');
        const zodPath = req.resolve('zod');
        const [sdk, zodMod] = await Promise.all([
          import(pathToFileURL(sdkPath).href),
          import(pathToFileURL(zodPath).href),
        ]);
        return {
          query: sdk.query,
          tool: sdk.tool,
          createSdkMcpServer: sdk.createSdkMcpServer,
          z: zodMod.z,
        };
      } catch {}
    }
  }
  throw new Error(
    'Unable to load @anthropic-ai/claude-agent-sdk and zod. Install them or set DOCS_IA_CLAUDE_SDK_NODE_MODULES.'
  );
}

/**
 * Create a workflow-compatible `agentExecutor` backed by `@anthropic-ai/claude-agent-sdk`
 * using local Claude subscription credentials and co-located in-process `docs-ia-tools` MCP bindings.
 */
export function createClaudeSdkExecutor({
  model = DEFAULT_CLAUDE_SDK_MODEL,
  effort = DEFAULT_CLAUDE_SDK_EFFORT,
  maxTurns = DEFAULT_CLAUDE_SDK_MAX_TURNS,
  allowedBuiltinTools = [],
  disallowedBuiltinTools = [
    'Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch',
    'Agent', 'Task', 'Skill', 'TodoWrite',
  ],
  cwd = process.cwd(),
  moduleSearchPaths = [],
  sdkLoader = defaultLoadClaudeSdk,
  authCheckFn = null,
  settingsCheckFn = inspectSettingsConflicts,
  canUseTool = null,
} = {}) {
  let verifiedAuth = false;

  return async function executeClaudeSdkAgent({
    step,
    promptText,
    schemaPath = null,
    tools: toolCatalog = null,
  }) {
    const cleanEnv = sanitizeSubscriptionEnv(process.env);
    const settingsCheck = settingsCheckFn({ cwd, env: cleanEnv });
    if (settingsCheck?.conflicts?.length) {
      throw new Error(`Refusing Claude Agent SDK run due to subscription conflict: ${settingsCheck.conflicts.join('; ')}`);
    }
    if (!verifiedAuth) {
      verifyLocalSubscriptionAuth({ cwd, env: cleanEnv, authCheckFn });
      verifiedAuth = true;
    }

    const sdk = await sdkLoader({ moduleSearchPaths });
    const mcpServers = {};
    let boundTools = [];
    if (toolCatalog && step.tools?.length > 0 && step.mcpServers?.includes('docs-ia-tools')) {
      const built = buildScopedSdkMcpServer({
        step,
        toolCatalog,
        createSdkMcpServer: sdk.createSdkMcpServer,
        tool: sdk.tool,
        z: sdk.z,
      });
      if (built.server) {
        mcpServers['docs-ia-tools'] = built.server;
        boundTools = built.boundTools;
      }
    }

    let outputFormat;
    if (schemaPath && existsSync(schemaPath)) {
      const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
      outputFormat = { type: 'json_schema', schema };
    }

    const effectiveModel = model || step.model || DEFAULT_CLAUDE_SDK_MODEL;
    const effectiveEffort = effort || step.effort || DEFAULT_CLAUDE_SDK_EFFORT;
    const abortController = new AbortController();
    const started = Date.now();

    const defaultCanUseTool = async (toolName, input) => {
      if (toolName.startsWith('mcp__docs-ia-tools__')) {
        const bare = toolName.slice('mcp__docs-ia-tools__'.length);
        if (boundTools.includes(bare)) return { behavior: 'allow', updatedInput: input };
        return { behavior: 'deny', message: `Tool ${bare} is not bound to workflow step ${step.id}.` };
      }
      if (allowedBuiltinTools.includes(toolName)) {
        return { behavior: 'allow', updatedInput: input };
      }
      return { behavior: 'deny', message: `Tool ${toolName} is not enabled for workflow step ${step.id}.` };
    };

    const q = sdk.query({
      prompt: promptText,
      options: {
        cwd,
        env: cleanEnv,
        abortController,
        model: effectiveModel,
        effort: effectiveEffort,
        maxTurns,
        tools: [...allowedBuiltinTools],
        disallowedTools: disallowedBuiltinTools.filter(t => !allowedBuiltinTools.includes(t)),
        canUseTool: canUseTool ?? defaultCanUseTool,
        ...(Object.keys(mcpServers).length > 0 ? { mcpServers } : {}),
        ...(outputFormat ? { outputFormat } : {}),
        strictMcpConfig: true,
        settingSources: [],
        settings: { autoMemoryEnabled: false },
        permissionMode: 'default',
        allowDangerouslySkipPermissions: false,
      },
    });

    let turns = 0;
    const toolCallsByName = {};
    let resultMsg = null;
    let lastText = '';

    for await (const msg of q) {
      if (msg?.type === 'system' && msg?.subtype === 'init') {
        try {
          const acct = typeof q.accountInfo === 'function' ? await q.accountInfo() : undefined;
          assertSubscriptionInit(msg, settingsCheck, acct);
        } catch (err) {
          abortController.abort();
          throw err;
        }
      } else if (msg?.type === 'assistant') {
        turns++;
        const blocks = msg.message?.content ?? msg.content ?? [];
        for (const b of blocks) {
          if (b?.type === 'tool_use' && b.name) {
            toolCallsByName[b.name] = (toolCallsByName[b.name] || 0) + 1;
          } else if (b?.type === 'text' && b.text) {
            lastText = b.text;
          }
        }
      } else if (msg?.type === 'result') {
        resultMsg = msg;
        if (typeof msg.result === 'string' && msg.result.trim()) lastText = msg.result;
      }
    }

    const structured = resultMsg?.structured_output ?? extractBalancedJson(lastText);
    return {
      conversationId: resultMsg?.session_id ?? null,
      provider: 'claude-sdk',
      model: effectiveModel,
      effort: effectiveEffort,
      wallMs: Date.now() - started,
      turns: resultMsg?.num_turns ?? turns,
      toolCallsByName,
      usage: resultMsg?.usage ?? {},
      costUsd: typeof resultMsg?.total_cost_usd === 'number' ? resultMsg.total_cost_usd : 0,
      rawResponse: String(lastText ?? ''),
      data: structured,
      boundTools,
      mcpServers: Object.keys(mcpServers),
    };
  };
}
