/**
 * The data-warehouse-source skill has a runtime contract with the wizard's
 * `wizard_ask` tool. The wizard counts its batching guard per `subject`, so a
 * run that walks 5-8 detected sources is only safe while this skill tells the
 * agent to tag every call. Telemetry showed the earlier text costing most of
 * the wizard's warehouse connections, so the contract is pinned here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DESCRIPTION = readFileSync(
    join(CONFIG_DIR, 'skills', 'data-warehouse-source', 'description.md'),
    'utf8',
);

/** The skill the install flow's seeded `warehouse` task loads. */
const STEP_SKILL = readFileSync(
    join(CONFIG_DIR, 'skills', 'integration-v2', 'warehouse', 'description.md'),
    'utf8',
);

describe('data-warehouse-source skill config', () => {
    it('expands to the single setup variant the wizard program loads', () => {
        const config = loadSkillsConfig(CONFIG_DIR);
        const skills = expandSkillGroups(config, CONFIG_DIR).filter(
            (s) => s._group === 'data-warehouse-source',
        );

        expect(skills.map((s) => s.id)).toEqual(['data-warehouse-source-setup']);
    });
});

describe('data-warehouse-source credential batching contract', () => {
    it('tells the agent to tag every wizard_ask call with a subject', () => {
        expect(DESCRIPTION).toMatch(/optional `subject` tag/);
        expect(DESCRIPTION).toMatch(/One `mcp__wizard-tools__wizard_ask` call per source/);
        expect(DESCRIPTION).toMatch(/set `subject` to the source kind/i);
    });

    it('states that the batching guard counts per subject, not per run', () => {
        expect(DESCRIPTION).toMatch(/counts its batching guard per subject/);
        expect(DESCRIPTION).toMatch(/never interrupted/);
    });

    it('forbids packing two sources into one 8-question call', () => {
        expect(DESCRIPTION).toMatch(/Never put two different sources in one call/);
    });

    it('frames the one-time nudge as retryable, not as a stop signal', () => {
        // Agents read the old nudge as a refusal and fell back to browser links.
        expect(DESCRIPTION).toMatch(/not a refusal and not a reason to stop/);
    });

    it('keeps the cancel/timeout refund promise the runtime honours', () => {
        expect(DESCRIPTION).toMatch(
            /cancelled or timed-out `wizard_ask` does \*\*not\*\* count against the per-run cap/,
        );
    });

    it('tells the agent to keep going after a single cancellation', () => {
        // One declined source used to end credential collection for the rest.
        expect(DESCRIPTION).toMatch(/A cancellation applies to that source only/);
        expect(DESCRIPTION).toMatch(/Do not stop the run/);
    });
});

describe('data-warehouse-source reporting contract', () => {
    it('requires a created-count line so a no-op run cannot read as a success', () => {
        expect(DESCRIPTION).toMatch(/Created N of M detected sources in PostHog/);
        expect(DESCRIPTION).toMatch(/A deep link is a handoff, not a created source/);
        expect(DESCRIPTION).toMatch(/Do not describe the run as complete, successful, or set up/);
    });

    it('maps each outcome onto a complete_task status the tool accepts', () => {
        for (const status of ['`done`', '`not needed`', '`failed`']) {
            expect(DESCRIPTION).toContain(status);
        }
        expect(DESCRIPTION).toMatch(/you created at least one source in PostHog/);
        expect(DESCRIPTION).toMatch(/you created no source, and a retry cannot change that/);
    });

    it('invents no status vocabulary beyond the two wizard abort cases', () => {
        const aborts = [...DESCRIPTION.matchAll(/\[ABORT\] ([^\n`.]+)/g)].map((m) => m[1].trim());
        expect([...new Set(aborts)].sort()).toEqual([
            'No data source detected',
            'Source creation failed',
        ]);
    });
});

describe('integration-v2 warehouse step skill', () => {
    it('tells the seeded install task to ask once per source, tagged with a subject', () => {
        expect(STEP_SKILL).toMatch(/One `wizard_ask` call per source, tagged with `subject`/);
        expect(STEP_SKILL).toMatch(/counts its batching guard per subject/);
        expect(STEP_SKILL).toMatch(/never interrupted/);
    });

    it('no longer asks the agent to pack several sources into one call', () => {
        // The old text told the agent to dodge the run-wide nudge by packing
        // sources together. Five sources need 15-25 fields, so that advice was
        // impossible and the agent fell back to browser links instead.
        expect(STEP_SKILL).not.toMatch(/pack\s+several sources into one call/);
        expect(STEP_SKILL).not.toMatch(/don't make one call per source/);
        expect(STEP_SKILL).toMatch(/Never put two different sources in one call/);
    });

    it('scopes a cancellation to one source instead of ending the round', () => {
        expect(STEP_SKILL).toMatch(/A decline answers one source, not the run/);
        expect(STEP_SKILL).toMatch(/Stop asking only after two cancellations/);
    });

    it('requires a connected-count line and a matching complete_task status', () => {
        expect(STEP_SKILL).toMatch(/Connected N of M detected sources/);
        expect(STEP_SKILL).toMatch(/A deep link is a handoff, not a\s+connection/);
        for (const status of ['`done`', '`not needed`', '`failed`']) {
            expect(STEP_SKILL).toContain(status);
        }
        expect(STEP_SKILL).toMatch(/you connected at least one source/);
    });
});
