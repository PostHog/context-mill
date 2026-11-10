import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import matter from 'gray-matter';

import { buildAgents } from '../agent-generator.js';
import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const configDir = join(process.cwd(), 'context');
const flowDir = join(configDir, 'agents', 'spend-audit');
const prompts = readdirSync(flowDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => matter(readFileSync(join(flowDir, file), 'utf8')).data);
const byType = new Map(prompts.map((prompt) => [prompt.type, prompt]));

const WRITERS = ['Write', 'Edit', 'Bash'];

describe('spend audit flow', () => {
    let distDir;
    afterEach(() => {
        if (distDir) rmSync(distDir, { recursive: true, force: true });
    });

    it('publishes one seed, one sink, and a task per audit area', () => {
        distDir = mkdtempSync(join(tmpdir(), 'spend-audit-'));
        buildAgents({ configDir, distDir, baseUrl: 'https://example.test' });
        const menu = JSON.parse(readFileSync(join(distDir, 'agents', 'agent-menu.json'), 'utf8'));
        const ids = menu.agents.filter((agent) => agent.flow === 'spend-audit').map((agent) => agent.id);
        expect(ids).toEqual(
            expect.arrayContaining([
                'plan-spend-audit',
                'measure-volumes',
                'audit-identify',
                'audit-groups',
                'audit-events',
                'audit-flags',
                'audit-errors',
                'audit-replay',
                'apply-code-fixes',
                'value-insights',
                'report',
            ]),
        );
        expect(prompts.filter((p) => p.seed).map((p) => p.type)).toEqual(['plan-spend-audit']);
        expect(prompts.filter((p) => p.sink).map((p) => p.type)).toEqual(['report']);
    });

    it('lets only the code-fix task edit the repository and only the sink publish the result', () => {
        for (const prompt of prompts) {
            const writes = (prompt.allowedTools ?? []).some((tool) => WRITERS.includes(tool));
            expect(writes, `${prompt.type} must not edit the repository`).toBe(prompt.type === 'apply-code-fixes');
            const publishes = (prompt.allowedTools ?? []).includes('publish_program_result');
            expect(publishes, `${prompt.type} must not publish the result`).toBe(prompt.type === 'report');
            // A headless cloud run cannot answer a question, so no task may ask one.
            expect(prompt.allowedTools ?? []).not.toContain('wizard_ask');
        }
    });

    it('keeps every audit area optional and the measurement and report required', () => {
        for (const type of ['audit-identify', 'audit-groups', 'audit-events', 'audit-flags', 'audit-errors', 'audit-replay']) {
            expect(byType.get(type).optional, `${type} must be optional`).toBe(true);
            expect(byType.get(type).dependsOn).toEqual(['measure-volumes']);
        }
        expect(byType.get('measure-volumes').optional).not.toBe(true);
        expect(byType.get('report').optional).not.toBe(true);
    });

    it('lets every task that loads a skill read it', () => {
        for (const prompt of prompts.filter((p) => (p.skills ?? []).length > 0)) {
            expect(prompt.allowedTools ?? [], `${prompt.type} must allow Read`).toContain('Read');
            expect(prompt.disallowedTools ?? [], `${prompt.type} must not disallow Read`).not.toContain('Read');
        }
    });

    it('loads only skills that exist', () => {
        const skills = new Set(expandSkillGroups(loadSkillsConfig(configDir), configDir).map((skill) => skill.id));
        for (const prompt of prompts) {
            for (const skill of prompt.skills ?? []) {
                expect(skills.has(skill), `${prompt.type} loads unknown skill ${skill}`).toBe(true);
            }
        }
    });
});
