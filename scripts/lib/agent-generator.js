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
 *   Output:  dist/agents/agent-<flow>-<type>.md  +  dist/agents/agent-menu.json
 *
 * Output filenames are flat (`agent-<flow>-<type>.md`), not nested under a
 * per-flow folder. GitHub release assets live in a single flat namespace — an
 * asset name cannot contain a slash — so a nested `agents/<flow>/<type>.md`
 * path is unfetchable once published. Both the release host and the dev server
 * therefore serve every prompt (and `agent-menu.json`) from the same flat root,
 * and each menu entry carries the full `downloadUrl` so the wizard never has to
 * compose one.
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_AGENTS_BASE_URL =
    'https://github.com/PostHog/context-mill/releases/latest/download';

/**
 * The flat release-asset filename for a prompt. Flow and id are joined into one
 * segment because GitHub release assets are a flat namespace (no slashes). The
 * `agent-` prefix namespaces these against skill assets in the shared release.
 */
export function agentAssetName(flow, id) {
    return `agent-${flow}-${id}.md`;
}

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
 * Copy every agent-prompt markdown file into dist/agents/ as a flat asset and
 * write the menu the wizard fetches to discover available types. Each menu
 * entry carries its flow and a full downloadUrl so the dev-server and the
 * release host can differ without the wizard composing URLs. Returns
 * { count, agentsDistDir }.
 */
export function buildAgents({ configDir, distDir, baseUrl, version = 'dev' }) {
    const agentsSourceDir = path.join(configDir, 'agents');
    const agentsDistDir = path.join(distDir, 'agents');
    const resolvedBase = (baseUrl || DEFAULT_AGENTS_BASE_URL).replace(/\/+$/, '');

    fs.mkdirSync(agentsDistDir, { recursive: true });

    const entries = loadAgentEntries(agentsSourceDir);
    const agents = [];
    const seenAssets = new Map();
    for (const { flow, id } of entries) {
        const sourcePath = path.join(agentsSourceDir, flow, `${id}.md`);
        assertFlowMatches(sourcePath, flow);
        const assetName = agentAssetName(flow, id);
        // Flattening flow+id into one segment could in principle collide (flow
        // "a" + id "b-c" vs flow "a-b" + id "c"). Fail the build rather than
        // silently overwrite one prompt with another.
        const clash = seenAssets.get(assetName);
        if (clash) {
            throw new Error(
                `Agent asset name "${assetName}" is produced by both ${clash} and ${flow}/${id} — rename one`,
            );
        }
        seenAssets.set(assetName, `${flow}/${id}`);
        fs.copyFileSync(sourcePath, path.join(agentsDistDir, assetName));
        agents.push({ id, flow, downloadUrl: `${resolvedBase}/${assetName}` });
    }

    const menu = { version: '1.0', buildVersion: version, agents };
    fs.writeFileSync(
        path.join(agentsDistDir, 'agent-menu.json'),
        JSON.stringify(menu, null, 2) + '\n',
    );

    // Reconcile: drop dist entries whose source markdown was removed. The layout
    // is flat, so anything that isn't a current asset or the menu goes —
    // including legacy per-flow folders left by an older build.
    const keep = new Set(agents.map(a => agentAssetName(a.flow, a.id)));
    keep.add('agent-menu.json');
    for (const dirent of fs.readdirSync(agentsDistDir, { withFileTypes: true })) {
        if (keep.has(dirent.name) && dirent.isFile()) continue;
        fs.rmSync(path.join(agentsDistDir, dirent.name), { recursive: true, force: true });
    }

    return { count: agents.length, agentsDistDir };
}
