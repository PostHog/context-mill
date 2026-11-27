#!/usr/bin/env node
// Single entry point for all Docs IA workflows, inspection, thin lookup queries,
// and scoped deterministic MCP tool serving.
//
// Usage:
//   pnpm docs-ia list
//   pnpm docs-ia inspect <workflow> [--json]
//   pnpm docs-ia run <workflow> --product <slug> [--dry-run] [--from <step>] [--to <step>] [--state <file>]
//   pnpm docs-ia query <fact|symbol|page|audit> <target> --file <json-or-yml>
//   pnpm docs-ia mcp-serve --tools <csv> [--state <file>]
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { describeWorkflow } from './models/workflow.mjs';
import { runWorkflow } from './runtime/runner.mjs';
import { queryAuditTrail, queryByPage, queryBySymbol, queryFact } from './tools/blast-radius.mjs';
import { startStdioMcpServer } from './tools/mcp-server.mjs';
import { getWorkflow, WORKFLOWS } from './workflows/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

function loadDataFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  return filePath.endsWith('.yml') || filePath.endsWith('.yaml') ? yaml.load(raw) : JSON.parse(raw);
}

function loadProductConfig(slug) {
  const p = join(REPO_ROOT, 'facts', 'products', `${slug}.yml`);
  if (!existsSync(p)) {
    throw new Error(`Product config not found: ${p}`);
  }
  return yaml.load(readFileSync(p, 'utf8'));
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) flags[key] = true;
      else { flags[key] = next; i++; }
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

function printWorkflowSummary(wf) {
  const desc = describeWorkflow(wf);
  console.log(`\n${desc.id} — ${desc.title} (RFC: ${desc.rfcSection || 'n/a'})`);
  console.log(`  ${desc.description}`);
  for (const s of desc.steps) {
    if (s.kind === 'script') {
      console.log(`  ${s.index}. [script] ${s.id} — ${s.description}`);
    } else {
      console.log(`  ${s.index}. [agent]  ${s.id} — ${s.model} (${s.effort}) | prompt=${s.prompt} | schema=${s.schema}`);
      console.log(`              tools=[${s.tools.join(', ')}] | mcp=[${s.mcpServers.join(', ')}]`);
    }
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const [cmd, arg1, arg2] = flags._;

  if (!cmd || cmd === 'help' || flags.help) {
    console.log([
      'PostHog Docs IA CLI (single entry point)',
      '',
      'Commands:',
      '  list                                          List all workflows and their step bindings',
      '  inspect <workflow> [--json]                   Inspect one workflow DAG and tool bindings',
      '  run <workflow> --product <slug> [--dry-run]   Execute a workflow (supports --from, --to, --state)',
      '  query <fact|symbol|page|audit> <q> --file <p> Run a fast lookup against IA/coverage/register data',
      '  mcp-serve --tools <csv> [--state <path>]      Start scoped stdio MCP server for an agent step',
    ].join('\n'));
    return;
  }

  if (cmd === 'list') {
    for (const wf of WORKFLOWS) printWorkflowSummary(wf);
    return;
  }

  if (cmd === 'inspect') {
    const wf = getWorkflow(arg1);
    if (flags.json) console.log(JSON.stringify(describeWorkflow(wf), null, 2));
    else printWorkflowSummary(wf);
    return;
  }

  if (cmd === 'run') {
    const wf = getWorkflow(arg1);
    const product = flags.product ? loadProductConfig(flags.product) : { slug: 'default', code: 'IA', surfaces: ['API'] };
    const initialState = flags.state ? loadDataFile(resolve(flags.state)) : {};
    const res = await runWorkflow(wf, {
      product,
      initialState,
      dryRun: Boolean(flags['dry-run']),
      fromStep: flags.from || null,
      toStep: flags.to || null,
      log: msg => console.error(msg),
    });
    console.log(JSON.stringify({ workflowId: res.workflowId, trace: res.trace }, null, 2));
    return;
  }

  if (cmd === 'query') {
    if (!flags.file) throw new Error('query requires --file <path-to-ia-or-register>');
    const data = loadDataFile(resolve(flags.file));
    let out;
    if (arg1 === 'fact') out = queryFact(data, arg2);
    else if (arg1 === 'symbol') out = queryBySymbol(data, arg2);
    else if (arg1 === 'page') out = queryByPage(data, arg2);
    else if (arg1 === 'audit') out = queryAuditTrail(data, arg2);
    else throw new Error(`Unknown query kind "${arg1}" (use fact|symbol|page|audit)`);
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  if (cmd === 'mcp-serve') {
    const allowedTools = typeof flags.tools === 'string'
      ? flags.tools.split(',').map(s => s.trim()).filter(Boolean)
      : null;
    startStdioMcpServer({
      statePath: flags.state ? resolve(flags.state) : null,
      allowedTools,
    });
    return;
  }

  throw new Error(`Unknown command "${cmd}". Run with --help.`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(err => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}
