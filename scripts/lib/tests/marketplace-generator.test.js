import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateMarketplace } from '../marketplace-generator.js';

// Two skills from different groups sharing one category — the real shape of the
// #309 collision: `omnibus/instrument-integration` and
// `omnibus/instrument-product-analytics` both declare `category: integration`
// with a single variant `id: all`.
const skill = (id, extra = {}) => ({
    id,
    shortId: 'all',
    category: 'integration',
    displayName: id,
    description: `${id} description`,
    ...extra,
});

let dir;
const tempDir = () => path.join(dir, 'built');
const configDir = () => path.join(dir, 'context');
const outputDir = () => path.join(dir, 'dist');
const pluginSkills = plugin =>
    fs.readdirSync(path.join(outputDir(), 'marketplace', 'plugins', plugin, 'skills'));

function writeSkillSource(id) {
    const skillDir = path.join(tempDir(), id);
    fs.mkdirSync(path.join(skillDir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `name: ${id}`);
    fs.writeFileSync(path.join(skillDir, 'references', `${id}.md`), `${id} docs`);
}

const run = skills =>
    generateMarketplace({
        skills,
        tempDir: tempDir(),
        version: 'test',
        outputDir: outputDir(),
        configDir: configDir(),
    });

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'marketplace-generator-'));
    fs.mkdirSync(configDir(), { recursive: true });
    fs.writeFileSync(
        path.join(configDir(), 'marketplace.yaml'),
        [
            'target_repo: PostHog/skills',
            'mega_plugin:',
            '  name: posthog-all',
            '  destination: skills/posthog/all',
            'plugins:',
            '  integration:',
            '    name: posthog-integration',
            '    destination: skills/posthog/integration',
            // A second plugin keeps the suite honest: keyed by `shortId` for even
            // one plugin, the assertions below fail.
            '  logs:',
            '    name: posthog-logs',
            '    destination: skills/posthog/logs',
        ].join('\n'),
    );
    writeSkillSource('omnibus-instrument-integration');
    writeSkillSource('omnibus-instrument-product-analytics');
    writeSkillSource('logs-setup');
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

// Regression tests for #309 — `posthog-integration` published
// `omnibus-instrument-product-analytics` under `skills/all` while the
// integration omnibus went missing, because plugin skill dirs were keyed by the
// group-scoped `shortId` instead of the globally-unique `id`.
describe('generateMarketplace', () => {
    it('gives every skill in a plugin its own directory, keyed by full id', () => {
        const skills = [
            skill('omnibus-instrument-integration'),
            skill('omnibus-instrument-product-analytics'),
            skill('logs-setup', { category: 'logs' }),
        ];

        const result = run(skills);

        // Keying by `shortId` collapsed both skills into `skills/all`, so one was
        // silently dropped and the survivor inherited the loser's leftover files.
        expect(pluginSkills('posthog-integration').sort()).toEqual([
            'omnibus-instrument-integration',
            'omnibus-instrument-product-analytics',
        ]);
        // Every plugin is keyed the same way — `logs-setup` would land in
        // `skills/all` too if any plugin still used `shortId`.
        expect(pluginSkills('posthog-logs')).toEqual(['logs-setup']);
        expect(result.skillCount).toBe(skills.length);
    });

    it('pools every skill into the mega-plugin under its own id', () => {
        const skills = [
            skill('omnibus-instrument-integration'),
            skill('omnibus-instrument-product-analytics'),
            skill('logs-setup', { category: 'logs' }),
        ];

        run(skills);

        expect(pluginSkills('posthog-all').sort()).toEqual([
            'logs-setup',
            'omnibus-instrument-integration',
            'omnibus-instrument-product-analytics',
        ]);
    });

    it('copies each skill intact, with no files bleeding across siblings', () => {
        run([
            skill('omnibus-instrument-integration'),
            skill('omnibus-instrument-product-analytics'),
        ]);

        const dirOf = id =>
            path.join(outputDir(), 'marketplace', 'plugins', 'posthog-integration', 'skills', id);

        for (const id of ['omnibus-instrument-integration', 'omnibus-instrument-product-analytics']) {
            expect(fs.readFileSync(path.join(dirOf(id), 'SKILL.md'), 'utf8')).toBe(`name: ${id}`);
            expect(fs.readdirSync(path.join(dirOf(id), 'references'))).toEqual([`${id}.md`]);
        }
    });

    it('skips a skill with no source dir instead of writing an empty one', () => {
        // `missing-skill` has no source dir, so it is skipped with a warning. The
        // build's own log line counts what was copied off the back of this.
        run([skill('omnibus-instrument-integration'), skill('missing-skill')]);

        expect(pluginSkills('posthog-integration')).toEqual(['omnibus-instrument-integration']);
    });

    // The mega-plugin pools every plugin's skills, so a collision across two
    // plugins reaches it even though neither plugin collides on its own. This
    // subsumes the same-plugin case: it only passes if the guard is build-scoped.
    it('throws when two skills in different plugins share an id', () => {
        expect(() =>
            run([skill('logs-setup'), skill('logs-setup', { category: 'logs' })]),
        ).toThrow(/Duplicate skill id "logs-setup"/);
    });
});
