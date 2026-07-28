import { describe, expect, it } from 'vitest';
import { join } from 'path';

import { expandSkillGroups, loadSkillsConfig, serializeSkill } from '../skill-generator.js';
import { generateCliEntries } from '../build-phases.js';

const CONFIG_DIR = join(process.cwd(), 'context');

// `wizard skill list` prints cliEntries and nothing else, so a skill we tell
// users to run has to reach this array or it looks like it doesn't exist.
describe('skills users are pointed at directly', () => {
    const skills = expandSkillGroups(loadSkillsConfig(CONFIG_DIR), CONFIG_DIR).map(serializeSkill);
    const entries = generateCliEntries({ allSkills: skills });
    const browsable = new Map(
        entries.filter(e => e.role === 'command' || e.role === 'skill').map(e => [e.skillId, e]),
    );

    it.each(['creating-product-tours'])('%s is browsable in `wizard skill list`', skillId => {
        expect(browsable.get(skillId)).toMatchObject({ skillId, role: 'skill' });
    });
});
