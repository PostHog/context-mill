#!/usr/bin/env node

/**
 * Visualize agent DAGs
 *
 * Renders each flow's task graph as the waves the executor runs it in — every
 * task in a wave starts together — then opens the page in a browser. Each task
 * carries the model and effort it runs at, so the shape of a flow and the cost of
 * running it are readable together.
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

/**
 * Group tasks into the waves the executor runs them in: a task's wave is one past
 * its deepest dependency, so everything sharing a wave becomes runnable together.
 */
function wavesOf(agents) {
    const byId = new Map(agents.map(a => [a.id, a]));
    const depth = new Map();
    const depthOf = id => {
        if (depth.has(id)) return depth.get(id);
        depth.set(id, 0); // guards a cycle from recursing forever
        const deps = (byId.get(id)?.dependsOn || []).filter(d => byId.has(d));
        const n = deps.length ? 1 + Math.max(...deps.map(depthOf)) : 0;
        depth.set(id, n);
        return n;
    };
    const waves = new Map();
    for (const a of agents.filter(x => !x.seed)) {
        const n = depthOf(a.id);
        if (!waves.has(n)) waves.set(n, []);
        waves.get(n).push(a);
    }
    return [...waves.keys()].sort((a, b) => a - b).map(n => ({ n, tasks: waves.get(n) }));
}

const escape = s =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const card = a => `
        <div class="task${a.seed ? ' seed' : ''}">
          <div class="name">${escape(a.label)}</div>
          <div class="meta">${escape(a.model)} · ${escape(a.effort)}</div>
          ${a.dependsOn.length ? `<div class="deps">after ${a.dependsOn.map(escape).join(', ')}</div>` : ''}
        </div>`;

function sectionFor(flow, agents) {
    const seed = agents.find(a => a.seed);
    const waves = wavesOf(agents);
    const rows = [];

    if (seed) {
        rows.push(`<div class="wave"><div class="label">seed — plans the graph</div>
      <div class="tasks">${card(seed)}</div></div>`);
        rows.push('<div class="arrow">↓</div>');
    }
    waves.forEach(({ tasks }, i) => {
        const label = tasks.length > 1 ? `${tasks.length} run in parallel` : '1 task';
        rows.push(`<div class="wave"><div class="label">${label}</div>
      <div class="tasks">${tasks.map(card).join('')}</div></div>`);
        if (i < waves.length - 1) rows.push('<div class="arrow">↓</div>');
    });

    return `<section>
    <h2>${escape(flow)} <span>${agents.length} agents · ${waves.length} waves</span></h2>
    ${rows.join('\n    ')}
  </section>`;
}

function render(flows) {
    const sections = [...flows.entries()].map(([f, a]) => sectionFor(f, a)).join('\n');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Agent DAGs</title>
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; margin: 2rem auto; max-width: 56rem;
         color: #1d1d1f; background: #fff; }
  h1 { font-size: 1.4rem; }
  h2 { font-size: 1.1rem; border-bottom: 1px solid #e5e5e5; padding-bottom: .4rem; }
  h2 span { font-weight: 400; color: #86868b; font-size: .85rem; }
  .wave { border: 1px solid #d8d8d8; border-radius: 10px; padding: .6rem .9rem 1rem; background: #fafafa; }
  .wave > .label { font-size: .75rem; text-transform: uppercase; letter-spacing: .04em;
                   color: #86868b; margin-bottom: .6rem; }
  .tasks { display: flex; flex-wrap: wrap; gap: .75rem; }
  .task { flex: 1 1 13rem; border: 1px solid #d8d8d8; border-radius: 8px; padding: .7rem .8rem;
          background: #fff; }
  .task.seed { background: #fdf2e9; border-color: #e8a33d; }
  .task .name { font-weight: 600; }
  .task .meta { color: #6e6e73; font-size: .8rem; margin-top: .15rem; }
  .task .deps { color: #86868b; font-size: .75rem; margin-top: .3rem; }
  .arrow { text-align: center; color: #b0b0b0; font-size: 1.1rem; margin: .35rem 0; }
</style>
</head>
<body>
<h1>Agent DAGs</h1>
${sections}
</body>
</html>
`;
}

const flows = loadFlows();
fs.writeFileSync(outPath, render(flows));

for (const [flow, agents] of flows) {
    const waves = wavesOf(agents);
    console.log(`${flow}: ${agents.length} agents in ${waves.length} waves — ${waves.map(w => w.tasks.length).join(' → ')}`);
}
console.log(`\n📊 ${outPath}`);

if (!process.env.NO_OPEN) {
    const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(opener, [outPath], { stdio: 'ignore', detached: true }).unref();
}
