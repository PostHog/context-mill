import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { generateMarketplace } from '../marketplace-generator.js';

let dir;
let tempDir;
let outputDir;
let configDir;

const MARKETPLACE_YAML = `
target_repo: PostHog/skills
mega_plugin:
  name: posthog-all
  description: All skills
  destination: skills/posthog/all
  keywords: [posthog]
  include_skill_reminder_hook: false
plugins:
  integration:
    name: posthog-integration
    description: Integration skills
    destination: skills/posthog/integration
    keywords: [posthog]
`;

function createBuiltSkill(id) {
    const skillDir = path.join(tempDir, id);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `# ${id}\n`);
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-gen-'));
    tempDir = path.join(dir, 'temp');
    outputDir = path.join(dir, 'dist');
    configDir = path.join(dir, 'context');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'marketplace.yaml'), MARKETPLACE_YAML);
});

afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('generateMarketplace', () => {
    it('skips cli.role === internal skills without leaking into plugins, posthog-all, or unmapped warnings', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const skills = [
            {
                id: 'integration-nextjs-app',
                shortId: 'app',
                category: 'integration',
                displayName: 'Next.js App Router',
                description: 'Public command skill',
                cli: { role: 'command', command: 'nextjs' },
            },
            {
                id: 'integration-skill-only',
                shortId: 'skill-only',
                category: 'integration',
                displayName: 'Skill Only',
                description: 'Discoverable skill',
                cli: { role: 'skill' },
            },
            {
                id: 'integration-hidden',
                shortId: 'hidden',
                category: 'integration',
                displayName: 'Hidden Integration',
                description: 'Internal skill in mapped category',
                cli: { role: 'internal' },
            },
            {
                id: 'sdk-posthog-python-v7',
                shortId: 'v7',
                category: 'sdk',
                displayName: 'Python 7.x.x',
                description: 'Internal SDK skill in unmapped category',
                cli: { role: 'internal' },
            },
        ];
        for (const s of skills) createBuiltSkill(s.id);

        const res = generateMarketplace({ skills, tempDir, version: '1.0.0', outputDir, configDir });

        expect(res.skillCount).toBe(2);
        expect(res.pluginCount).toBe(2);

        const integrationSkillsDir = path.join(outputDir, 'marketplace', 'plugins', 'posthog-integration', 'skills');
        const megaSkillsDir = path.join(outputDir, 'marketplace', 'plugins', 'posthog-all', 'skills');

        expect(fs.readdirSync(integrationSkillsDir).sort()).toEqual(['integration-nextjs-app', 'integration-skill-only']);
        expect(fs.readdirSync(megaSkillsDir).sort()).toEqual(['integration-nextjs-app', 'integration-skill-only']);
        expect(warnSpy).not.toHaveBeenCalled();
    });

    it('keeps skills from two groups in one plugin apart when their shortIds match', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const config = fs.readFileSync(path.join(configDir, 'marketplace.yaml'), 'utf8');
        fs.writeFileSync(path.join(configDir, 'marketplace.yaml'), config.replace(
            'plugins:\n',
            'plugins:\n  omnibus:\n    name: posthog-integration\n    description: Integration skills\n    destination: skills/posthog/integration\n    keywords: [posthog]\n',
        ));
        const skills = [
            { id: 'omnibus-all', shortId: 'all', category: 'omnibus', displayName: 'omnibus-all', description: 'omnibus-all' },
            { id: 'integration-all', shortId: 'all', category: 'integration', displayName: 'integration-all', description: 'integration-all' },
            { id: 'integration-django', shortId: 'django', category: 'integration', displayName: 'integration-django', description: 'integration-django' },
        ];
        for (const skill of skills) {
            createBuiltSkill(skill.id);
            fs.writeFileSync(path.join(tempDir, skill.id, `only-${skill.id}.md`), skill.id);
        }

        generateMarketplace({ skills, tempDir, version: '1.0.0', outputDir, configDir });

        const skillsDir = path.join(outputDir, 'marketplace', 'plugins', 'posthog-integration', 'skills');
        expect(fs.readdirSync(skillsDir).sort()).toEqual(['integration-all', 'integration-django', 'omnibus-all']);
        for (const name of fs.readdirSync(skillsDir)) {
            expect(fs.readdirSync(path.join(skillsDir, name)).sort()).toEqual(['SKILL.md', `only-${name}.md`]);
            expect(fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8')).toContain(`# ${name}`);
        }
        expect(log).toHaveBeenCalledWith('  ✓ posthog-integration (3 skills)');
    });

    it('counts only the skills it copied in the plugin log line', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const present = { id: 'integration-django', shortId: 'django', category: 'integration', displayName: 'django', description: 'django' };
        const missing = { ...present, id: 'integration-missing', shortId: 'missing' };
        createBuiltSkill(present.id);

        generateMarketplace({ skills: [present, missing], tempDir, version: '1.0.0', outputDir, configDir });

        expect(log).toHaveBeenCalledWith('  ✓ posthog-integration (1 skills)');
    });
});
