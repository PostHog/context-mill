import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

// The spend audit's orchestrator prompts live in the wizard, at
// `src/programs/spend-audit/agent/`. This repo publishes the mini-skills those
// prompts load, so these checks hold the skill set and its shape in place.
const CONFIG_DIR = join(process.cwd(), 'context');
const groups = Object.entries(loadSkillsConfig(CONFIG_DIR)).filter(([key]) => key.startsWith('spend-audit/'));
const skills = expandSkillGroups(loadSkillsConfig(CONFIG_DIR), CONFIG_DIR).filter((skill) =>
    skill._group.startsWith('spend-audit/'),
);

const SKILL_IDS = [
    'spend-audit-code-fixes',
    'spend-audit-errors',
    'spend-audit-events',
    'spend-audit-findings',
    'spend-audit-flags',
    'spend-audit-groups',
    'spend-audit-identify',
    'spend-audit-insights',
    'spend-audit-notebook',
    'spend-audit-queries',
    'spend-audit-replay',
    'spend-audit-result',
];

describe('spend audit skills', () => {
    it('publishes twelve mini-skills, each written once', () => {
        expect(skills.map((skill) => skill.id).sort()).toEqual(SKILL_IDS);
        for (const [key, group] of groups) {
            expect(group.type, key).toBe('docs-only');
            expect(group.variants.map((variant) => variant.id), key).toEqual(['all']);
        }
    });

    it.each(groups)('%s keeps its template in its own folder and ships no pages of its own', (key, group) => {
        expect(group.template).toBe('description.md');
        expect(existsSync(join(CONFIG_DIR, 'skills', ...key.split('/'), group.template))).toBe(true);
        expect(group.shared_docs ?? []).toEqual([]);
        for (const variant of group.variants) {
            expect(variant.docs_urls ?? []).toEqual([]);
        }
    });

    // Every skill is loaded by a task of the wizard's spend-audit flow, never typed by a user.
    it.each(skills.map((skill) => [skill.id, skill]))('%s is internal to the orchestrator', (_, skill) => {
        expect(skill._cli).toEqual({ role: 'internal' });
        expect(skill.tags).toEqual(expect.arrayContaining(['orchestrator', 'spend-audit']));
    });

    // A task's model, tools and dependencies are the wizard prompt's to set, so no skill restates them.
    it.each(groups)('%s carries no orchestrator frontmatter', (key, group) => {
        const template = readFileSync(join(CONFIG_DIR, 'skills', ...key.split('/'), group.template), 'utf8');
        expect(template.startsWith('---'), `${key} must not open with frontmatter`).toBe(false);
        expect(template).not.toMatch(/^(allowedTools|disallowedTools|dependsOn|model_pi|model_sdk):/m);
    });
});
