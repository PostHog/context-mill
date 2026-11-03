/**
 * The Wizard's `transactional-email` program runs this skill by its ID and
 * matches the `[ABORT]` reasons of its Wizard section, so both are pinned here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig } from '../skill-generator.js';

const CONFIG_DIR = join(process.cwd(), 'context');
const DESCRIPTION = readFileSync(
    join(CONFIG_DIR, 'skills', 'sending-transactional-emails', 'description.md'),
    'utf8',
);

function skill() {
    const config = loadSkillsConfig(CONFIG_DIR);
    return expandSkillGroups(config, CONFIG_DIR).filter(
        (s) => s._group === 'sending-transactional-emails',
    );
}

describe('sending-transactional-emails skill', () => {
    it('expands to the one skill ID the Wizard program runs', () => {
        expect(skill().map((s) => s.id)).toEqual(['sending-transactional-emails']);
    });

    it('fetches the PostHog skill under its own name, so it is not taken for this SKILL.md', () => {
        expect(skill()[0].docs_urls[0]).toMatchObject({
            url: 'https://raw.githubusercontent.com/PostHog/posthog/master/products/messaging/skills/sending-transactional-emails/SKILL.md',
            filename: 'sending-transactional-emails.md',
        });
        expect(DESCRIPTION).toContain('Read `references/sending-transactional-emails.md` first');
    });

    it.each(['transactional email api not enabled', 'no server code found'])(
        'keeps the "%s" abort the Wizard program matches',
        (reason) => {
            expect(DESCRIPTION).toContain(`emit \`[ABORT] ${reason}\` and stop`);
        },
    );
});
