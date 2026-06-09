/**
 * Agent-prompt content type — the WHAT of the orchestrator runner.
 *
 * An agent prompt is one markdown file per task type. Its frontmatter carries
 * the artifacts the executor configures the run with (model, skills, tools,
 * dependsOn); its body is the instruction the task agent reads. Unlike skills,
 * agent prompts are self-contained single files with no references/, so they are
 * served as raw markdown rather than zipped. The wizard parses the frontmatter
 * when it loads a task by type.
 *
 *   Source:  transformation-config/agents/<type>.md
 *   Output:  dist/agents/<type>.md  +  dist/agents/agent-menu.json
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_AGENTS_BASE_URL =
    'https://github.com/PostHog/context-mill/releases/latest/download/agents';

/** The agent ids available in source, derived from the `<type>.md` filenames. */
export function loadAgentIds(agentsSourceDir) {
    if (!fs.existsSync(agentsSourceDir)) return [];
    return fs
        .readdirSync(agentsSourceDir)
        .filter(f => f.endsWith('.md'))
        .map(f => f.slice(0, -'.md'.length))
        .sort();
}

/**
 * Copy every agent-prompt markdown file into dist/agents/ and write the menu the
 * wizard fetches to discover available types. The menu carries a full
 * downloadUrl per agent so the dev-server and the release host can differ
 * without the wizard composing URLs. Returns { count, agentsDistDir }.
 */
export function buildAgents({ configDir, distDir, baseUrl, version = 'dev' }) {
    const agentsSourceDir = path.join(configDir, 'agents');
    const agentsDistDir = path.join(distDir, 'agents');
    const resolvedBase = (baseUrl || DEFAULT_AGENTS_BASE_URL).replace(/\/+$/, '');

    fs.mkdirSync(agentsDistDir, { recursive: true });

    const ids = loadAgentIds(agentsSourceDir);
    const agents = [];
    for (const id of ids) {
        fs.copyFileSync(
            path.join(agentsSourceDir, `${id}.md`),
            path.join(agentsDistDir, `${id}.md`),
        );
        agents.push({ id, downloadUrl: `${resolvedBase}/${id}.md` });
    }

    const menu = { version: '1.0', buildVersion: version, agents };
    fs.writeFileSync(
        path.join(agentsDistDir, 'agent-menu.json'),
        JSON.stringify(menu, null, 2) + '\n',
    );

    // Reconcile: drop dist files whose source markdown was removed.
    const keep = new Set(ids.map(id => `${id}.md`));
    keep.add('agent-menu.json');
    for (const file of fs.readdirSync(agentsDistDir)) {
        if (!keep.has(file)) fs.rmSync(path.join(agentsDistDir, file));
    }

    return { count: agents.length, agentsDistDir };
}
