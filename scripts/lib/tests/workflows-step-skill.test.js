/**
 * The integration flow's seeded `workflows` task writes proposals that the
 * wizard parses after the run and creates as draft PostHog workflows. The file
 * path, the empty shape, and the worked examples are a contract with the
 * wizard's validator, so they are pinned here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const SKILL_DIR = join(CONFIG_DIR, 'skills', 'integration-v2', 'workflows');
const AGENT = matter(
    readFileSync(join(CONFIG_DIR, 'agents', 'integration-v2', 'workflows.md'), 'utf8'),
);
const DESCRIPTION = readFileSync(join(SKILL_DIR, 'description.md'), 'utf8');
const EXAMPLES = readFileSync(join(SKILL_DIR, 'references', 'examples.md'), 'utf8');

const PROPOSALS_FILE = '.posthog-wizard-cache/.posthog-workflows.json';
const ALLOWED_TYPES = new Set([
    'trigger',
    'delay',
    'wait_until_condition',
    'conditional_branch',
    'function_email',
    'exit',
]);
const EXAMPLE_EVENTS = new Set(['user_signed_up', 'notebook_created', 'subscription_canceled']);

function exampleProposals() {
    return [...EXAMPLES.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
}

function eventIds(filters) {
    return (filters?.events ?? []).map((e) => e.id);
}

describe('workflows step skill', () => {
    it('expands to the skill id the workflows agent loads', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const ids = expandSkillGroups(config, CONFIG_DIR).map((s) => s.id);

        expect(ids).toContain('integration-v2-workflows');
        expect(AGENT.data.skills).toEqual(['integration-v2-workflows']);
    });

    it('is seeded by the wizard after the reviewed integration, and creates nothing itself', () => {
        expect(AGENT.data.runnerSeeded).toBe(true);
        expect(AGENT.data.dependsOn).toEqual(['capture', 'identify', 'review']);
        expect(AGENT.data.allowedTools).not.toContain('Edit');
        expect(AGENT.data.allowedTools).not.toContain('posthog_exec');
        expect(AGENT.data.allowedTools).not.toContain('wizard_ask');
    });

    it('names the proposals file and its empty shape the wizard reads', () => {
        expect(AGENT.content).toContain(PROPOSALS_FILE);
        expect(DESCRIPTION).toContain(PROPOSALS_FILE);
        expect(DESCRIPTION).toContain('{ "proposals": [] }');
    });
});

describe('workflows step examples', () => {
    const proposals = exampleProposals();

    it('has two complete proposals', () => {
        expect(proposals).toHaveLength(2);
    });

    it.each(proposals.map((p) => [p.title, p]))('%s passes the wizard checks', (_title, proposal) => {
        const { workflow } = proposal;
        const ids = new Set(workflow.actions.map((a) => a.id));
        const triggers = workflow.actions.filter((a) => a.type === 'trigger');

        expect(JSON.stringify(workflow)).not.toContain('"bytecode"');
        expect(workflow).not.toHaveProperty('trigger');
        expect(workflow).not.toHaveProperty('status');
        expect(workflow.name).toMatch(/ \(wizard\)$/);
        expect(triggers).toHaveLength(1);
        expect(triggers[0].config.type).toBe('event');

        for (const action of workflow.actions) {
            expect(ALLOWED_TYPES.has(action.type)).toBe(true);
        }

        const referenced = [
            ...eventIds(triggers[0].config.filters),
            ...(workflow.conversion?.events ?? []).flatMap((g) => eventIds(g.filters)),
            ...workflow.actions
                .filter((a) => a.type === 'wait_until_condition')
                .flatMap((a) => a.config.events.flatMap((e) => eventIds(e.filters))),
        ];
        for (const event of referenced) {
            expect(EXAMPLE_EVENTS.has(event)).toBe(true);
        }

        for (const edge of workflow.edges) {
            expect(ids.has(edge.from)).toBe(true);
            expect(ids.has(edge.to)).toBe(true);
        }
        for (const action of workflow.actions.filter((a) => a.type !== 'exit')) {
            expect(workflow.edges.some((e) => e.from === action.id)).toBe(true);
        }
        for (const wait of workflow.actions.filter((a) => a.type === 'wait_until_condition')) {
            const out = workflow.edges.filter((e) => e.from === wait.id);
            expect(out.some((e) => e.type === 'branch' && e.index === 0)).toBe(true);
            expect(out.some((e) => e.type === 'continue')).toBe(true);
        }

        for (const email of workflow.actions.filter((a) => a.type === 'function_email')) {
            const value = email.config.inputs.email.value;
            expect(value.to.email).toBe('{{ person.properties.email }}');
            expect(value.from).toEqual({ email: '', name: '' });
            expect(value.subject).toBeTruthy();
            expect(value.text).toBeTruthy();
        }
    });
});
