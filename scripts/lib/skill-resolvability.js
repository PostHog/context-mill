/**
 * Skill resolvability
 *
 * The wizard picks a run's skill by menu id or by skill family. This module
 * runs that pick over a built menu and reports the frameworks a family
 * resolves nothing for and the entries no pick reaches. It is pure: the build
 * hands it the menu and what the wizard picks with.
 */

/** The match key every family pick requires. */
const FRAMEWORK_KEY = 'framework';

/** The tag that breaks a ranking tie. */
const DEFAULT_TAG = 'default';

/** A match key value no tag names. */
const UNNAMED = '\u0000unnamed';

/** The menu's entries, each with its skill family: its category key with `/` as `-`. */
function menuEntries(menu) {
    return Object.entries(menu.categories).flatMap(([category, entries]) =>
        entries.map(entry => ({ ...entry, family: category.replaceAll('/', '-') })),
    );
}

/** An entry's `key:value` tags, as values per key. */
function matchKeysOf(entry) {
    const keys = new Map();
    for (const tag of new Set(entry.tags ?? [])) {
        const at = tag.indexOf(':');
        if (at <= 0) continue;
        const key = tag.slice(0, at);
        keys.set(key, [...(keys.get(key) ?? []), tag.slice(at + 1)]);
    }
    return keys;
}

/**
 * The entry `name` stands for in a run with the match keys `keys`, such as
 * `{ framework: ['nextjs'] }`. It is `resolveSkill` in the wizard's
 * `src/shared/skill-resolution.ts`, rule for rule.
 */
function resolveSkill(entries, name, keys) {
    const exact = entries.find(entry => entry.id === name);
    if (exact) return exact;
    if (!keys[FRAMEWORK_KEY]?.length) return undefined;

    let best;
    let bestScore = -1;
    for (const entry of entries) {
        if (entry.family !== name) continue;
        const declared = matchKeysOf(entry);
        if (!declared.has(FRAMEWORK_KEY)) continue;

        let agreeing = 0;
        let disagrees = false;
        for (const [key, values] of declared) {
            const run = Object.hasOwn(keys, key) ? keys[key] : undefined;
            if (!run?.length) continue;
            if (values.some(value => run.includes(value))) agreeing += 1;
            else disagrees = true;
        }
        if (disagrees) continue;

        const score = agreeing * 2 + ((entry.tags ?? []).includes(DEFAULT_TAG) ? 1 : 0);
        if (score > bestScore) {
            best = entry;
            bestScore = score;
        }
    }
    return best;
}

/**
 * The families a run picks from by framework: each task-named skill that is
 * no menu id, and the pack family once a task names a skill that is completed
 * from the framework's pack.
 */
function pickedFamilies(entries, { taskSkills, packFamily }) {
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const families = taskSkills.filter(name => !byId.has(name));
    if (taskSkills.some(name => byId.get(name)?.frameworkReferences)) families.push(packFamily);
    return [...new Set(families)];
}

/**
 * Every run on `framework` the family's tags tell apart. Each other match key
 * the framework's entries name takes no value, each value they name, and a
 * value none names.
 */
function runsOn(framework, members) {
    const named = new Map();
    for (const entry of members) {
        const declared = matchKeysOf(entry);
        if (!declared.get(FRAMEWORK_KEY)?.includes(framework)) continue;
        for (const [key, values] of declared) {
            if (key === FRAMEWORK_KEY) continue;
            named.set(key, new Set([...(named.get(key) ?? []), ...values]));
        }
    }
    let runs = [{ [FRAMEWORK_KEY]: [framework] }];
    for (const [key, values] of named) {
        runs = runs.flatMap(run => [run, ...[...values, UNNAMED].map(value => ({ ...run, [key]: [value] }))]);
    }
    return runs;
}

/** Why no pick reaches `entry`. */
function unreachableReason(entry, frameworks) {
    const served = matchKeysOf(entry).get(FRAMEWORK_KEY);
    if (!served) return `it has no ${FRAMEWORK_KEY}: tag`;
    if (!served.some(framework => frameworks.includes(framework))) {
        return `the wizard detects no ${served.map(framework => `${FRAMEWORK_KEY}:${framework}`).join(' or ')}`;
    }
    return 'another entry outranks it on every run';
}

/**
 * Check a built skill menu against what the wizard picks with.
 *
 * `missing` lists each `{ family, framework }` whose run on that framework
 * alone resolves no skill. `unreachable` lists each `{ family, id, reason }`
 * of a picked family that no run on a detected framework resolves to; such
 * an entry is still served by its id.
 */
function checkSkillResolvability(menu, { frameworks, taskSkills, packFamily }) {
    const entries = menuEntries(menu);
    const families = pickedFamilies(entries, { taskSkills, packFamily });
    const missing = [];
    const unreachable = [];
    for (const family of families) {
        const members = entries.filter(entry => entry.family === family);
        const reached = new Set();
        for (const framework of frameworks) {
            if (!resolveSkill(entries, family, { [FRAMEWORK_KEY]: [framework] })) missing.push({ family, framework });
            for (const run of runsOn(framework, members)) {
                const pick = resolveSkill(entries, family, run);
                if (pick) reached.add(pick.id);
            }
        }
        for (const entry of members) {
            if (!reached.has(entry.id)) {
                unreachable.push({ family, id: entry.id, reason: unreachableReason(entry, frameworks) });
            }
        }
    }
    return { families, missing, unreachable };
}

/** The build error for `missing`: every family with the frameworks it resolves nothing for. */
function missingMessage(missing) {
    const byFamily = new Map();
    for (const { family, framework } of missing) {
        byFamily.set(family, [...(byFamily.get(family) ?? []), framework]);
    }
    return [
        'A wizard run on these frameworks resolves no skill. Each family needs a menu entry tagged framework:<framework>:',
        ...[...byFamily].map(([family, frameworks]) => `  ${family}: ${frameworks.join(', ')}`),
    ].join('\n');
}

export { resolveSkill, checkSkillResolvability, missingMessage };
