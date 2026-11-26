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

        expect(fs.readdirSync(integrationSkillsDir).sort()).toEqual(['app', 'skill-only']);
        expect(fs.readdirSync(megaSkillsDir).sort()).toEqual(['integration-nextjs-app', 'integration-skill-only']);
        expect(warnSpy).not.toHaveBeenCalled();
    });
});
