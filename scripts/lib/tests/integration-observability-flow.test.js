import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import matter from 'gray-matter';

import { buildAgents } from '../agent-generator.js';
import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const configDir = join(process.cwd(), 'context');
const flowDir = join(configDir, 'agents', 'integration-v2');
const prompts = readdirSync(flowDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => matter(readFileSync(join(flowDir, file), 'utf8')).data);
const byType = new Map(prompts.map((prompt) => [prompt.type, prompt]));

function ancestors(type, visiting = new Set()) {
    if (visiting.has(type)) throw new Error(`Dependency cycle at ${type}`);
    const prompt = byType.get(type);
    if (!prompt) throw new Error(`Unknown dependency ${type}`);
    const next = new Set([...visiting, type]);
    return new Set((prompt.dependsOn ?? []).flatMap((dep) => [dep, ...ancestors(dep, next)]));
}

describe('default integration observability flow', () => {
    let distDir;
    afterEach(() => {
        if (distDir) rmSync(distDir, { recursive: true, force: true });
    });

    it('publishes both tasks with tools that can discover their existing product skills', () => {
        distDir = mkdtempSync(join(tmpdir(), 'integration-observability-'));
        buildAgents({ configDir, distDir, baseUrl: 'https://example.test' });
        const menu = JSON.parse(readFileSync(join(distDir, 'agents', 'agent-menu.json'), 'utf8'));
        const skills = expandSkillGroups(loadSkillsConfig(configDir), configDir);

        for (const type of ['ai-observability', 'logs']) {
            const entry = menu.agents.find((agent) => agent.flow === 'integration-v2' && agent.id === type);
            expect(entry).toBeDefined();
            const asset = entry.downloadUrl.split('/').pop();
            const { data } = matter(readFileSync(join(distDir, 'agents', asset), 'utf8'));
            expect(data.allowedTools).toEqual(expect.arrayContaining(['load_skill_menu', 'install_skill']));
            expect(data.allowedTools).not.toContain('wizard_ask');
            expect(data.allowedTools).not.toContain('Bash');
            expect(data.seed).not.toBe(true);
            expect(data.runnerSeeded).not.toBe(true);
            // Optionality lives in the task definition; the planner has no say.
            expect(data.optional).toBe(true);
            expect(skills.some((skill) => skill._category === type)).toBe(true);
        }
    });

    it('serializes the new writers after existing instrumentation and before review', () => {
        for (const type of ['install', 'init', 'identify', 'capture']) {
            expect(ancestors('ai-observability').has(type)).toBe(true);
        }
        // error-tracking runs parallel to AIO; review still waits on both.
        expect(ancestors('ai-observability').has('error-tracking')).toBe(false);
        expect(ancestors('logs').has('ai-observability')).toBe(true);
        const reviewed = ancestors('review');
        for (const prompt of prompts.filter((p) => p.type !== 'review' && p.allowedTools?.some((t) => ['Write', 'Edit'].includes(t)))) {
            expect(reviewed.has(prompt.type), `${prompt.type} must finish before review`).toBe(true);
        }
        expect(ancestors('report').has('logs')).toBe(true);
        expect(ancestors('report').has('ai-observability')).toBe(true);
        expect(byType.get('report').sink).toBe(true);
        expect(ancestors('dashboard').has('logs')).toBe(false);
    });
});
