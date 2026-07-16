/**
 * Agent-prompt content type — the WHAT of the orchestrator runner.
 *
 * An agent prompt is one markdown file per task type, grouped in a folder per
 * flow. Its frontmatter carries the artifacts the executor configures the run
 * with (model, skills, tools, dependsOn); its body is the instruction the task
 * agent reads. Unlike skills, agent prompts are self-contained single files
 * with no references/, so they are served as raw markdown rather than zipped.
 * The wizard parses the frontmatter when it loads a task by type.
 *
 *   Source:  context/agents/<flow>/<type>.md
 *   Output:  dist/agents/<flow>/<type>.md  +  dist/agents/agent-menu.json
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_AGENTS_BASE_URL =
    'https://github.com/PostHog/context-mill/releases/latest/download';

/**
 * The agent prompts available in source: one { flow, id } per
 * `<flow>/<type>.md`. README.md files are author documentation, not served
 * prompts. A markdown file directly under agents/ is a layout error — prompts
 * are always flow-scoped.
 */
export function loadAgentEntries(agentsSourceDir) {
    if (!fs.existsSync(agentsSourceDir)) return [];
    const entries = [];
    for (const dirent of fs.readdirSync(agentsSourceDir, { withFileTypes: true })) {
        if (dirent.name === 'README.md') continue;
        if (dirent.isFile() && dirent.name.endsWith('.md')) {
            throw new Error(
                `Agent prompt "${dirent.name}" sits directly under agents/ — move it into a flow folder (agents/<flow>/${dirent.name})`,
            );
        }
        if (!dirent.isDirectory()) continue;
        const flow = dirent.name;
        const flowDir = path.join(agentsSourceDir, flow);
        for (const file of fs.readdirSync(flowDir)) {
            if (!file.endsWith('.md') || file === 'README.md') continue;
            entries.push({ flow, id: file.slice(0, -'.md'.length) });
        }
    }
    return entries.sort((a, b) => a.flow.localeCompare(b.flow) || a.id.localeCompare(b.id));
}

/**
 * A prompt's frontmatter `flow:` must be present and match its folder —
 * consumers filter by it, so a missing key would silently drop the prompt.
 */
function assertFlowMatches(sourcePath, flow) {
    const text = fs.readFileSync(sourcePath, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const declared = match?.[1].match(/^flow:\s*(.+?)\s*$/m)?.[1];
    if (!declared) {
        throw new Error(
            `Agent prompt ${sourcePath} is missing the "flow:" frontmatter key — declare flow: ${flow}`,
        );
    }
    if (declared !== flow) {
        throw new Error(
            `Agent prompt ${sourcePath} declares flow "${declared}" but lives in agents/${flow}/`,
        );
    }
}

/**
 * Copy every agent-prompt markdown file into dist/agents/<flow>/ and write the
 * menu the wizard fetches to discover available types. Each menu entry carries
 * its flow and a full downloadUrl so the dev-server and the release host can
 * differ without the wizard composing URLs. Returns { count, agentsDistDir }.
 */
export function buildAgents({ configDir, distDir, baseUrl, version = 'dev' }) {
    const agentsSourceDir = path.join(configDir, 'agents');
    const agentsDistDir = path.join(distDir, 'agents');
    const resolvedBase = (baseUrl || DEFAULT_AGENTS_BASE_URL).replace(/\/+$/, '');

    fs.mkdirSync(agentsDistDir, { recursive: true });

    const entries = loadAgentEntries(agentsSourceDir);
    const agents = [];
    for (const { flow, id } of entries) {
        const sourcePath = path.join(agentsSourceDir, flow, `${id}.md`);
        assertFlowMatches(sourcePath, flow);
        const assetName = `agents-${flow}-${id}.md`;
        fs.copyFileSync(sourcePath, path.join(agentsDistDir, assetName));
        agents.push({ id, flow, downloadUrl: `${resolvedBase}/${assetName}` });
    }

    const menu = { version: '1.0', buildVersion: version, agents };
    fs.writeFileSync(
        path.join(agentsDistDir, 'agent-menu.json'),
        JSON.stringify(menu, null, 2) + '\n',
    );

    // Reconcile: drop dist files and folders whose source markdown was removed.
    const keep = new Set(entries.map(e => `agents-${e.flow}-${e.id}.md`));
    keep.add('agent-menu.json');
    const walk = dir => {
        for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                walk(abs);
                if (fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
            } else if (!keep.has(path.relative(agentsDistDir, abs))) {
                fs.rmSync(abs);
            }
        }
    };
    walk(agentsDistDir);

    return { count: agents.length, agentsDistDir };
}
