import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { expandSkillGroups } from '../skill-generator.js';

function createFixture(tree, baseDir) {
    for (const [name, content] of Object.entries(tree)) {
        const fullPath = join(baseDir, name);
        if (typeof content === 'string') {
            writeFileSync(fullPath, content);
        } else {
            mkdirSync(fullPath, { recursive: true });
            createFixture(content, fullPath);
        }
    }
}

describe('variants_from', () => {
    let tmpDir;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'skills-test-'));
        mkdirSync(join(tmpDir, 'skills'));
        createFixture({
            skills: {
                integration: { 'description.md': '# Integration for {display_name}' },
                'flow-x': { install: { 'description.md': '# Install for {display_name}' } },
            },
        }, tmpDir);
    });

    afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

    const integrationGroup = () => ({
        type: 'skill',
        template: 'description.md',
        variants: [
            {
                id: 'django',
                display_name: 'Django',
                framework: 'django',
                default: true,
                tags: ['django', 'python'],
                docs_urls: ['https://posthog.com/docs/libraries/django.md'],
                example_paths: 'example-apps/django',
            },
        ],
    });

    const borrowingGroup = () => ({
        type: 'docs-only',
        template: 'description.md',
        tags: ['orchestrator', 'install'],
        variants_from: 'integration',
    });

    it('borrows the source matrix: id, display_name, tags, docs_urls', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        const skills = expandSkillGroups(config, tmpDir);
        const step = skills.find(s => s.id === 'flow-x-install-django');
        expect(step).toBeDefined();
        expect(step.display_name).toBe('Django');
        expect(step.docs_urls).toEqual(['https://posthog.com/docs/libraries/django.md']);
    });

    it('merges the borrowing group tags with the source variant tags', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        const skills = expandSkillGroups(config, tmpDir);
        const step = skills.find(s => s.id === 'flow-x-install-django');
        expect(step.tags).toEqual(['orchestrator', 'install', 'django', 'python']);
    });

    it('does not inherit example paths from the source variants', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        const skills = expandSkillGroups(config, tmpDir);
        const step = skills.find(s => s.id === 'flow-x-install-django');
        expect(step._examplePaths).toEqual([]);
    });

    it('borrows capture_mode so a mode-specific variant step resolves like the source', () => {
        const integration = integrationGroup();
        integration.variants.push({
            id: 'django-v1',
            display_name: 'Django (capture v1)',
            framework: 'django',
            capture_mode: 'v1',
            tags: ['django', 'python'],
        });
        const config = { integration, 'flow-x/install': borrowingGroup() };
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills.find(s => s.id === 'flow-x-install-django-v1').capture_mode).toBe('v1');
        expect(skills.find(s => s.id === 'flow-x-install-django').capture_mode).toBeUndefined();
    });

    it('rejects a capture_mode outside legacy and v1', () => {
        const integration = integrationGroup();
        integration.variants[0].capture_mode = 'v2';
        expect(() => expandSkillGroups({ integration }, tmpDir)).toThrow(/capture_mode must be "legacy" or "v1"/);
    });

    it('borrows framework and default so variant steps resolve like the source', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        const skills = expandSkillGroups(config, tmpDir);
        const step = skills.find(s => s.id === 'flow-x-install-django');
        expect(step.framework).toBe('django');
        expect(step.default).toBe(true);
    });

    it('does not mutate the input config', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        expandSkillGroups(config, tmpDir);
        expect(config['flow-x/install'].variants).toBeUndefined();
        expect(config['flow-x/install']._variantsResolved).toBeUndefined();
    });

    it('leaves the source group untouched', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        const skills = expandSkillGroups(config, tmpDir);
        const source = skills.find(s => s.id === 'integration-django');
        expect(source.tags).toEqual(['django', 'python']);
        expect(source._examplePaths).toEqual(['example-apps/django']);
    });

    it('expanding the same config twice is stable', () => {
        const config = { integration: integrationGroup(), 'flow-x/install': borrowingGroup() };
        expandSkillGroups(config, tmpDir);
        const skills = expandSkillGroups(config, tmpDir);
        expect(skills.filter(s => s.id === 'flow-x-install-django')).toHaveLength(1);
    });

    it('throws when the source group does not exist', () => {
        const config = { 'flow-x/install': { ...borrowingGroup(), variants_from: 'nope' } };
        expect(() => expandSkillGroups(config, tmpDir)).toThrow(/does not name a skill group/);
    });

    it('throws when a group declares both variants and variants_from', () => {
        const config = {
            integration: integrationGroup(),
            'flow-x/install': { ...borrowingGroup(), variants: [{ id: 'x', display_name: 'X' }] },
        };
        expect(() => expandSkillGroups(config, tmpDir)).toThrow(/not both/);
    });

    it('throws when variants_from chains', () => {
        const config = {
            integration: integrationGroup(),
            'flow-x/install': borrowingGroup(),
            'flow-x/init': { ...borrowingGroup(), variants_from: 'flow-x/install' },
        };
        expect(() => expandSkillGroups(config, tmpDir)).toThrow(/cannot chain/);
    });
});
