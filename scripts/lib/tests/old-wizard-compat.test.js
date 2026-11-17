// Wizard versions already in the field resolve the skills their prompts name with the logic vendored below.
// The snapshot lists the names and frameworks they ask for whose skills still publish, with the skill each resolves to.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadAndExpandSkills, serializeSkill } from '../skill-generator.js';
import { writeManifestAndMenu } from '../build-phases.js';

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

/** A snapshot key is `<name>@<framework>`, with `-` for a run that detected no framework. */
const splitKey = key => {
    const at = key.lastIndexOf('@');
    return [key.slice(0, at), key.slice(at + 1)];
};

let dir;
let menu;
let expanded;
let entries;

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
    menu = JSON.parse(fs.readFileSync(path.join(dir, 'skills', 'skill-menu.json'), 'utf8'));

    // The wizard expands bundles on fetch, so every resolver sees the flattened menu.
    expanded = {
        ...menu,
        categories: Object.fromEntries(
            Object.entries(menu.categories).map(([c, es]) => [c, es.flatMap(expandBundleEntry)]),
        ),
    };
    entries = Object.values(expanded.categories).flat();
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('old wizard compatibility', () => {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));

    it('resolves every skill name and framework reference to the same id', () => {
        for (const [key, id] of Object.entries(snapshot.variants)) {
            const [skillId, framework] = splitKey(key);
            expect(resolveSkillVariantId(entries, skillId, framework === '-' ? undefined : framework), key).toBe(id);
        }
    });

    it('selects the same spellbook skills', () => {
        for (const [key, ids] of Object.entries(snapshot.spellbook)) {
            const [flow, framework] = splitKey(key);
            const session = flow === 'posthog-integration' ? { skillId: framework, integration: framework } : { integration: framework };
            expect(selectSkills(expanded, session, { id: flow }).map(e => e.id), key).toEqual(ids);
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
    });
});
