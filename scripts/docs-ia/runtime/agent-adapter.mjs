// Co-located agent execution adapter for Antigravity CLI (`agy --print`).
//
// Reads a workflow `agentStep`'s declared `tools` and `mcpServers`, generates a scoped
// session settings JSON binding `docs-ia-tools` to ONLY that step's allowlisted deterministic
// tools, and invokes `agy` with the step's exact `model`, `effort`, `prompt`, and `schema`.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(HERE, '..', 'cli.mjs');

/**
 * Build the scoped MCP server settings block for a single agent step.
 * Only tools listed in `step.tools` are passed via `--tools` to `cli.mjs mcp-serve`.
 */
export function buildScopedMcpSettings({ step, stateSnapshotPath }) {
  const mcpServers = {};
  if (step.mcpServers.includes('docs-ia-tools') && step.tools.length > 0) {
    mcpServers['docs-ia-tools'] = {
      command: process.execPath,
      args: [
        CLI_PATH,
        'mcp-serve',
        '--tools',
        step.tools.join(','),
        ...(stateSnapshotPath ? ['--state', stateSnapshotPath] : []),
      ],
    };
  }
  return { mcpServers };
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

/**
 * Default live agent executor backed by `agy --print`.
 * For tests and offline replays, callers pass a custom `agentExecutor` to `runWorkflow`.
 */
export async function executeAgyAgent({
  step,
  promptText,
  schemaPath,
  stateSnapshot = null,
  cwd = process.cwd(),
  timeoutMs = 180_000,
}) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'docs-ia-step-'));
  let stateSnapshotPath = null;
  let settingsPath = null;

  try {
    if (stateSnapshot && step.tools.length > 0) {
      stateSnapshotPath = join(tmpDir, 'state.json');
      writeFileSync(stateSnapshotPath, JSON.stringify(stateSnapshot));
    }
    const mcpSettings = buildScopedMcpSettings({ step, stateSnapshotPath });
    if (Object.keys(mcpSettings.mcpServers).length > 0) {
      settingsPath = join(tmpDir, 'settings.json');
      writeFileSync(settingsPath, JSON.stringify(mcpSettings, null, 2));
    }

    const args = [
      '--output-format', 'json',
      '--model', step.model,
      '--effort', step.effort,
      '--disable-slash-commands',
    ];
    if (schemaPath) args.push('--json-schema', schemaPath);
    if (settingsPath) args.push('--settings', settingsPath);
    args.push(`--print=${promptText}`);

    const started = Date.now();
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn('agy', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        rejectPromise(new Error(`agy timed out after ${timeoutMs}ms (${step.id}: ${step.model}/${step.effort})`));
      }, timeoutMs);

      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => { clearTimeout(timer); rejectPromise(err); });
      child.on('close', code => {
        clearTimeout(timer);
        const wallMs = Date.now() - started;
        const lines = stdout.trim().split('\n').filter(Boolean);
        let parsed = null;
        try { parsed = JSON.parse(lines.at(-1) ?? ''); } catch {
          const idx = stdout.lastIndexOf('{"conversation_id"');
          if (idx >= 0) {
            try { parsed = JSON.parse(stdout.slice(idx)); } catch {}
          }
        }
        if (code !== 0 || !parsed || parsed.status !== 'SUCCESS') {
          rejectPromise(new Error(`agy exit=${code} (${step.id}): ${(parsed?.error || stderr || stdout).slice(0, 400)}`));
          return;
        }
        resolvePromise({
          conversationId: parsed.conversation_id ?? null,
          model: step.model,
          effort: step.effort,
          wallMs,
          usage: parsed.usage ?? {},
          rawResponse: String(parsed.response ?? ''),
          data: extractBalancedJson(parsed.response),
          boundTools: [...step.tools],
          mcpServers: [...step.mcpServers],
        });
      });
    });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function runPool(items, concurrency, fn) {
  const queue = [...items];
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const idx = cursor++;
      results[idx] = await fn(queue[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
