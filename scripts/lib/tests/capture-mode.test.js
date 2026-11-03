import { describe, it, expect } from 'vitest';
import { serializeSkill } from '../skill-generator.js';

const base = { id: 'integration-python', _shortId: 'python', _category: 'integration', display_name: 'Python', description: 'd', _group: 'integration' };

describe('serializeSkill: capture mode', () => {

    it('emits captureMode for a tagged variant and nothing for an untagged one', () => {
        expect(serializeSkill({ ...base, capture_mode: 'v1' }).captureMode).toBe('v1');
        expect(serializeSkill(base)).not.toHaveProperty('captureMode');
    });
});

describe('capture_mode across the real configs', () => {
    it('every variant in context/skills carries a valid capture_mode or none', async () => {
        const path = await import('path');
        const { loadAndExpandSkills } = await import('../skill-generator.js');
        const configDir = path.resolve(import.meta.dirname, '..', '..', '..', 'context');
        // expandSkillGroups throws on an invalid value, so loading proves the configs.
        const { skills } = loadAndExpandSkills({ configDir });
        expect(skills.length).toBeGreaterThan(100);
        for (const skill of skills) {
            expect([undefined, 'legacy', 'v1']).toContain(skill.capture_mode);
        }
    });
});

describe('capture_mode from config to skill-menu.json', () => {
    it('reaches a plain entry and a bundled variant through the generator and the menu writer', async () => {
        const fs = await import('fs');
        const os = await import('os');
        const path = await import('path');
        const { expandSkillGroups } = await import('../skill-generator.js');
        const { writeManifestAndMenu } = await import('../build-phases.js');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-mode-e2e-'));
        try {
            fs.mkdirSync(path.join(dir, 'config', 'skills', 'integration'), { recursive: true });
            fs.mkdirSync(path.join(dir, 'config', 'skills', 'flow', 'install'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'config', 'skills', 'integration', 'description.md'), '# {display_name}');
            fs.writeFileSync(path.join(dir, 'config', 'skills', 'flow', 'install', 'description.md'), '# {display_name}');
            fs.writeFileSync(
                path.join(dir, 'config', 'uri-schema.yaml'),
                'manifest_version: "1.0"\nscheme: posthog://\npatterns:\n  skill: skills/{group}/{id}\n  doc: docs/{id}\n',
            );
            const config = {
                integration: {
                    type: 'skill',
                    template: 'description.md',
                    variants: [
                        { id: 'python', display_name: 'Python', framework: 'python' },
                        { id: 'python-v1', display_name: 'Python v1', framework: 'python', capture_mode: 'v1' },
                    ],
                },
                'flow/install': { type: 'docs-only', template: 'description.md', packaging: 'bundle', variants_from: 'integration' },
            };
            const skills = expandSkillGroups(config, path.join(dir, 'config'));
            const allSkills = skills.map(serializeSkill);
            writeManifestAndMenu({ allSkills, docContents: {}, distDir: path.join(dir, 'dist'), configDir: path.join(dir, 'config'), version: '1.0.0' });
            const menu = JSON.parse(fs.readFileSync(path.join(dir, 'dist', 'skills', 'skill-menu.json'), 'utf8'));
            const entries = Object.values(menu.categories).flat();
            const plain = entries.find(e => e.id === 'integration-python-v1');
            const untagged = entries.find(e => e.id === 'integration-python');
            const bundle = entries.find(e => e.bundle);
            expect(plain.captureMode).toBe('v1');
            expect(untagged).not.toHaveProperty('captureMode');
            expect(bundle.variants.find(v => v.id === 'flow-install-python-v1').captureMode).toBe('v1');
            expect(bundle.variants.find(v => v.id === 'flow-install-python')).not.toHaveProperty('captureMode');
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }

describe('collectCommandments: capture mode', () => {
    const config = {
        commandments: {
            all: ['every skill'],
            python: ['both modes'],
            'python@v1': ['v1 only'],
        },
    };

    it('adds the v1 rules once per tag only to a variant that declares v1', async () => {
        const { collectCommandments } = await import('../skill-generator.js');
        expect(collectCommandments(['python', 'python'], config, 'v1')).toEqual(['every skill', 'both modes', 'v1 only']);
        expect(collectCommandments(['python'], config, 'legacy')).toEqual(['every skill', 'both modes']);
        // Untagged is mode-neutral: a skill that serves either mode never carries a mode rule.
        expect(collectCommandments(['python'], config, undefined)).toEqual(['every skill', 'both modes']);
    });
});
    });
});

describe('the real commandments are mode-safe', () => {
    const load = async () => {
        const path = await import('path');
        const { loadCommandments, loadAndExpandSkills } = await import('../skill-generator.js');
        const configDir = path.resolve(import.meta.dirname, '..', '..', '..', 'context');
        return { commandments: loadCommandments(configDir).commandments, skills: loadAndExpandSkills({ configDir }).skills };
    };

    it('has no legacy-only keys: an untagged variant must read as mode-neutral', async () => {
        const { commandments } = await load();
        expect(Object.keys(commandments).filter(k => k.endsWith('@legacy'))).toEqual([]);
    });

    it('every @v1 key has a base tag some variant carries', async () => {
        const { commandments, skills } = await load();
        const tags = new Set(skills.flatMap(s => s.tags || []));
        for (const key of Object.keys(commandments).filter(k => k.includes('@'))) {
            const [tag, mode] = key.split('@');
            expect(mode, key).toBe('v1');
            expect(tags.has(tag), key).toBe(true);
        }
    });

    it('spells capture v1 option keys the way every SDK does', async () => {
        const { commandments } = await load();
        const text = Object.values(commandments).flat().map(String).join('\n');
        // Every v1 SDK reads snake_case option keys; capture ignores unknown keys silently.
        expect(text).not.toMatch(/processPersonProfile|cookielessMode|disableSkewCorrection/);
    });
});
