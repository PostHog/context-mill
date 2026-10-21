import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateMarketplace } from '../marketplace-generator.js';

const MARKETPLACE_YAML = `
target_repo: PostHog/skills
mega_plugin:
  name: posthog-all
  destination: skills/posthog/all
plugins:
  omnibus:
    name: posthog-integration
    destination: skills/posthog/integration
  integration:
    name: posthog-integration
    destination: skills/posthog/integration
`;

let dir;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-generator-'));
    fs.mkdirSync(path.join(dir, 'config'));
    fs.writeFileSync(path.join(dir, 'config', 'marketplace.yaml'), MARKETPLACE_YAML);
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
});

/** A built skill folder as generateSkills leaves it in tempDir, plus its skill entry. */
const addSkill = (category, shortId) => {
    const id = `${category}-${shortId}`;
    const skillDir = path.join(dir, 'temp', id);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---\nname: ${id}\n---\n`);
    fs.writeFileSync(path.join(skillDir, `only-${id}.md`), id);
    return { id, shortId, category, displayName: id, description: id };
};

describe('generateMarketplace', () => {
    it('keeps skills from two groups in one plugin apart when their shortIds match', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const skills = [addSkill('omnibus', 'all'), addSkill('integration', 'all'), addSkill('integration', 'django')];

        generateMarketplace({
            skills,
            tempDir: path.join(dir, 'temp'),
            version: '1.0.0',
            outputDir: path.join(dir, 'dist'),
            configDir: path.join(dir, 'config'),
        });

        const skillsDir = path.join(dir, 'dist', 'marketplace', 'plugins', 'posthog-integration', 'skills');
        expect(fs.readdirSync(skillsDir).sort()).toEqual(['integration-all', 'integration-django', 'omnibus-all']);
        for (const name of fs.readdirSync(skillsDir)) {
            expect(fs.readdirSync(path.join(skillsDir, name)).sort()).toEqual(['SKILL.md', `only-${name}.md`]);
            expect(fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8')).toContain(`name: ${name}`);
        }
        expect(log).toHaveBeenCalledWith('  ✓ posthog-integration (3 skills)');
    });

    it('counts only the skills it copied in the plugin log line', () => {
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const present = addSkill('integration', 'django');
        const missing = { ...present, id: 'integration-missing', shortId: 'missing' };

        generateMarketplace({
            skills: [present, missing],
            tempDir: path.join(dir, 'temp'),
            version: '1.0.0',
            outputDir: path.join(dir, 'dist'),
            configDir: path.join(dir, 'config'),
        });

        expect(log).toHaveBeenCalledWith('  ✓ posthog-integration (1 skills)');
    });
});
