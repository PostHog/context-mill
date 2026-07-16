#!/usr/bin/env node

/**
 * Visualize agent DAGs
 *
 * Renders each flow's task graph — the `dependsOn` edges between its agent
 * prompts — as a mermaid diagram on one page, then opens it in a browser. Each
 * node carries the model and effort that task runs at, so the shape of the graph
 * and the cost of running it are readable together.
 *
 * Usage:
 *   npm run visual-dags
 *   NO_OPEN=1 npm run visual-dags   # write the page, don't open it
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { spawn } from 'child_process';

import { loadAgentEntries } from './lib/agent-generator.js';

const repoRoot = path.join(import.meta.dirname, '..');
const agentsSourceDir = path.join(repoRoot, 'context', 'agents');
const outPath = path.join(os.tmpdir(), 'context-mill-agent-dags.html');

/** Read every agent prompt's frontmatter, grouped by flow. */
function loadFlows() {
    const flows = new Map();
    for (const { flow, id } of loadAgentEntries(agentsSourceDir)) {
        const source = fs.readFileSync(path.join(agentsSourceDir, flow, `${id}.md`), 'utf-8');
        const { data } = matter(source);
        if (!flows.has(flow)) flows.set(flow, []);
        flows.get(flow).push({
            id,
            label: data.label || id,
            seed: data.seed === true,
            dependsOn: data.dependsOn || [],
            model: String(data.model_pi || '').replace(/^.*\//, '') || '—',
            effort: data.effort_pi || '—',
        });
    }
    return flows;
}

const escape = s => String(s).replace(/"/g, '&quot;');

/** One mermaid flowchart per flow: dependency edges, seed called out separately. */
function diagramFor(agents) {
    const lines = ['flowchart TD'];
    for (const a of agents) {
        const detail = a.seed ? 'seed · plans this graph' : `${a.model} · ${a.effort}`;
        lines.push(`    ${a.id}["${escape(a.label)}<br/><small>${escape(detail)}</small>"]`);
    }
    for (const a of agents) {
        for (const dep of a.dependsOn) lines.push(`    ${dep} --> ${a.id}`);
    }
    const seeds = agents.filter(a => a.seed).map(a => a.id);
    if (seeds.length) lines.push(`    class ${seeds.join(',')} seed;`);
    lines.push('    classDef seed fill:#fdf2e9,stroke:#e8a33d,stroke-width:2px;');
    return lines.join('\n');
}

function render(flows) {
    const sections = [...flows.entries()]
        .map(
            ([flow, agents]) =>
                `<section><h2>${escape(flow)} <span>${agents.length} agents</span></h2>` +
                `<pre class="mermaid">${diagramFor(agents)}</pre></section>`,
        )
        .join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Agent DAGs</title>
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 2rem auto; max-width: 60rem; color: #1d1d1f; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.1rem; border-bottom: 1px solid #e5e5e5; padding-bottom: .4rem; }
  h2 span { font-weight: 400; color: #86868b; font-size: .85rem; }
  section { margin: 2.5rem 0; }
  .mermaid { text-align: center; }
</style>
</head>
<body>
<h1>Agent DAGs</h1>
${sections}
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
</script>
</body>
</html>
`;
}

const flows = loadFlows();
fs.writeFileSync(outPath, render(flows));

for (const [flow, agents] of flows) {
    console.log(`${flow}: ${agents.length} agents, ${agents.reduce((n, a) => n + a.dependsOn.length, 0)} edges`);
}
console.log(`\n📊 ${outPath}`);

if (!process.env.NO_OPEN) {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [outPath], { stdio: 'ignore', detached: true }).unref();
}
