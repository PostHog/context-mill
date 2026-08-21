import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');

const SHARED_DOCS = [
    'https://posthog.com/docs/metrics/start-here.md',
    'https://posthog.com/docs/metrics/basics.md',
    'https://posthog.com/docs/metrics/architecture.md',
];

function expandMetricsSkills() {
    const config = loadSkillsConfig(CONFIG_DIR);
    return expandSkillGroups(config, CONFIG_DIR);
}

describe('metrics Python variant', () => {
    it('expands to the skill contract consumed by the wizard', () => {
        const python = expandMetricsSkills().find((skill) => skill.id === 'metrics-python');

        expect(python).toMatchObject({
            id: 'metrics-python',
            frameworks: ['python', 'django', 'flask', 'fastapi'],
            _shortId: 'python',
            _category: 'metrics',
            _group: 'metrics',
            display_name: 'Python',
            description: 'PostHog metrics for Python',
            tags: ['metrics', 'python'],
            docs_urls: ['https://posthog.com/docs/metrics/installation/python.md'],
            _sharedDocs: SHARED_DOCS,
            _cli: null,
        });
    });
});

describe('metrics Node.js variant', () => {
    it('expands to the skill contract consumed by the wizard', () => {
        const nodejs = expandMetricsSkills().find((skill) => skill.id === 'metrics-nodejs');

        expect(nodejs).toMatchObject({
            id: 'metrics-nodejs',
            _shortId: 'nodejs',
            _category: 'metrics',
            _group: 'metrics',
            display_name: 'Node.js',
            description: 'PostHog metrics for Node.js',
            tags: ['metrics', 'javascript'],
            docs_urls: ['https://posthog.com/docs/metrics/installation/nodejs.md'],
            _sharedDocs: SHARED_DOCS,
            _cli: null,
        });
    });
});

describe('metrics web JavaScript variant', () => {
    it('expands to the skill contract consumed by the wizard', () => {
        const web = expandMetricsSkills().find((skill) => skill.id === 'metrics-javascript');

        expect(web).toMatchObject({
            id: 'metrics-javascript',
            _shortId: 'javascript',
            _category: 'metrics',
            _group: 'metrics',
            display_name: 'Web (JavaScript)',
            description: 'PostHog metrics for Web (JavaScript)',
            tags: ['metrics', 'javascript_web', 'javascript'],
            docs_urls: ['https://posthog.com/docs/metrics/installation/javascript.md'],
            _sharedDocs: SHARED_DOCS,
            _cli: null,
        });
    });
});

describe('metrics OTLP fallback variant', () => {
    it('covers languages without SDK support via the OTLP exporter doc', () => {
        const other = expandMetricsSkills().find((skill) => skill.id === 'metrics-other');

        expect(other).toMatchObject({
            id: 'metrics-other',
            _shortId: 'other',
            _category: 'metrics',
            _group: 'metrics',
            display_name: 'Other Languages',
            description: 'PostHog metrics for Other Languages',
            tags: ['metrics'],
            docs_urls: ['https://posthog.com/docs/metrics/installation/other.md'],
            _sharedDocs: SHARED_DOCS,
            _cli: null,
        });
    });
});

describe('metrics Kubernetes variant', () => {
    it('expands to the skill contract consumed by the wizard', () => {
        const k8s = expandMetricsSkills().find((skill) => skill.id === 'metrics-kubernetes');

        expect(k8s).toMatchObject({
            id: 'metrics-kubernetes',
            _shortId: 'kubernetes',
            _category: 'metrics',
            _group: 'metrics',
            display_name: 'Kubernetes',
            description: 'PostHog metrics for Kubernetes',
            tags: ['metrics', 'kubernetes'],
            docs_urls: ['https://posthog.com/docs/metrics/installation/kubernetes.md'],
            _sharedDocs: SHARED_DOCS,
            _cli: null,
        });
    });
});

describe('metrics group', () => {
    it('stays off the CLI surface (reachable via `wizard skill <id>` only)', () => {
        const metricsSkills = expandMetricsSkills().filter((skill) => skill._group === 'metrics');
        expect(metricsSkills.length).toBeGreaterThanOrEqual(5);
        for (const skill of metricsSkills) {
            expect(skill._cli).toBeNull();
        }
    });
});
