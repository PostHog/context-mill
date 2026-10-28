// Wizard versions already in the field resolve agent-prompt skills with the logic vendored below.
// Regenerate the snapshot after a deliberate menu change: UPDATE_OLD_WIZARD_SNAPSHOT=1 npm run test:skills
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadAndExpandSkills, serializeSkill } from '../skill-generator.js';
import { writeManifestAndMenu } from '../build-phases.js';
import { buildAgents } from '../agent-generator.js';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..', '..');
const CONFIG_DIR = path.join(REPO_ROOT, 'context');
const SNAPSHOT = path.join(import.meta.dirname, 'fixtures', 'old-wizard-resolutions.json');

// Vendored from the wizard: src/shared/skill-menu.ts
function expandBundleEntry(entry) {
    if (!entry.bundle || !entry.variants) return [entry];
    return entry.variants.map(variant => ({
        ...variant,
        name: entry.name,
        group: entry.group,
        bundle: true,
        downloadUrl: entry.downloadUrl,
    }));
}

// Vendored from the wizard: src/agent/runner/sequence/orchestrator/orchestrator-runner.ts
function resolveSkillVariantId(entries, skillId, framework) {
    if (entries.some(e => e.id === skillId)) return skillId;
    if (!framework) return undefined;
    const family = entries.filter(e => e.group === skillId && e.framework === framework);
    return (family.find(e => e.default) ?? family[0])?.id;
}

// Vendored from the wizard: src/tui/services/wizard-spellbook.ts
function selectSkills(menu, session, program) {
    const entries = Object.values(menu.categories)
        .flat()
        .filter(entry => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id));
    const skillId = program.skillId ?? session.skillId;
    const exact = entries.find(entry => entry.id === skillId);
    if (exact) return [exact];

    const framework = session.integration;
    const referenceGroup = skillId === framework ? 'integration' : skillId;
    const references = entries.filter(
        entry => entry.group === referenceGroup && entry.framework === framework,
    );
    const reference = references.find(entry => entry.default) ?? references[0];
    if (reference) return [reference];

    const flow = program.agentFlow ?? program.id;
    const groups = new Map();
    for (const entry of entries) {
        const group = entry.group;
        if (
            !group ||
            (group !== flow && !group.startsWith(`${flow}-`)) ||
            (entry.framework && entry.framework !== framework)
        ) {
            continue;
        }
        if (!groups.has(group) || entry.default) groups.set(group, entry);
    }
    return [...groups.values()];
}

function agentSkills(flow, id) {
    const text = fs.readFileSync(path.join(CONFIG_DIR, 'agents', flow, `${id}.md`), 'utf8');
    const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
    const list = frontmatter.match(/^skills:\s*\[(.*)\]\s*$/m)?.[1] ?? '';
    return list.split(',').map(s => s.trim()).filter(Boolean);
}

let dir;
let menu;
let entries;
let agentMenu;
let current;

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'old-wizard-compat-'));
    const { skills } = loadAndExpandSkills({ configDir: CONFIG_DIR });
    writeManifestAndMenu({
        allSkills: skills.map(serializeSkill),
        docContents: {},
        distDir: dir,
        configDir: CONFIG_DIR,
        version: 'dev',
    });
    buildAgents({ configDir: CONFIG_DIR, distDir: dir, version: 'dev' });
    menu = JSON.parse(fs.readFileSync(path.join(dir, 'skills', 'skill-menu.json'), 'utf8'));
    agentMenu = JSON.parse(fs.readFileSync(path.join(dir, 'agents', 'agent-menu.json'), 'utf8'));

    // The wizard expands bundles on fetch, so every resolver sees the flattened menu.
    const expanded = {
        ...menu,
        categories: Object.fromEntries(
            Object.entries(menu.categories).map(([c, es]) => [c, es.flatMap(expandBundleEntry)]),
        ),
    };
    entries = Object.values(expanded.categories).flat();
    const frameworks = [...new Set(entries.map(e => e.framework).filter(Boolean))].sort();

    const agents = {};
    const variants = {};
    const spellbook = {};
    for (const { id, flow, downloadUrl } of agentMenu.agents) {
        agents[`${flow}/${id}`] = path.basename(downloadUrl);
        for (const skillId of agentSkills(flow, id)) {
            for (const framework of [undefined, ...frameworks]) {
                const resolved = resolveSkillVariantId(entries, skillId, framework);
                if (resolved) variants[`${skillId}@${framework ?? '-'}`] = resolved;
            }
        }
    }
    const flows = [...new Set(agentMenu.agents.map(a => a.flow))];
    for (const framework of frameworks) {
        const reference = resolveSkillVariantId(entries, 'integration', framework);
        if (reference) variants[`integration@${framework}`] = reference;
        const ids = selectSkills(expanded, { skillId: framework, integration: framework }, { id: 'posthog-integration' }).map(e => e.id);
        if (ids.length) spellbook[`posthog-integration@${framework}`] = ids;
        for (const flow of flows) {
            const flowIds = selectSkills(expanded, { integration: framework }, { id: flow }).map(e => e.id);
            if (flowIds.length) spellbook[`${flow}@${framework}`] = flowIds;
        }
    }
    current = { agents, variants, spellbook };
    if (process.env.UPDATE_OLD_WIZARD_SNAPSHOT) {
        fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
        fs.writeFileSync(SNAPSHOT, JSON.stringify(current, null, 2) + '\n');
    }
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('old wizard compatibility', () => {
    it('publishes every agent prompt the snapshot knows, at the same asset name', () => {
        const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
        for (const [key, asset] of Object.entries(snapshot.agents)) {
            expect(current.agents[key], key).toBe(asset);
        }
    });

    it('resolves every agent skill and framework reference to the same id', () => {
        const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
        for (const [key, id] of Object.entries(snapshot.variants)) {
            expect(current.variants[key], key).toBe(id);
        }
    });

    it('selects the same spellbook skills', () => {
        const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
        for (const [key, ids] of Object.entries(snapshot.spellbook)) {
            expect(current.spellbook[key], key).toEqual(ids);
        }
    });

    it('keeps the fields old wizards read', () => {
        for (const entry of entries) {
            expect(typeof entry.id).toBe('string');
            expect(typeof entry.name).toBe('string');
            expect(typeof entry.group).toBe('string');
            expect(entry.downloadUrl).toMatch(/\.(zip|json)$/);
            if ('framework' in entry) expect(typeof entry.framework).toBe('string');
            if ('default' in entry) expect(entry.default).toBe(true);
        }
        for (const agent of agentMenu.agents) {
            expect(typeof agent.id).toBe('string');
            expect(typeof agent.flow).toBe('string');
            expect(agent.downloadUrl).toMatch(/\.md$/);
        }
    });
});
