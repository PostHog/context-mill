/**
 * Skill resolvability
 *
 * The wizard picks a run's skill by menu id or by skill family. This module
 * runs that pick over a built menu and reports the task-named skills the menu
 * lacks, the runs a family resolves nothing for and the entries no pick
 * reaches. It is pure: the build hands it the menu and what the wizard picks
 * with.
 */

/** The match key every family pick requires. */
const FRAMEWORK_KEY = 'framework';

/** The tag that breaks a ranking tie. */
const DEFAULT_TAG = 'default';

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
 * What the task-named skills pick from: `families`, each name that is no menu
 * id and has entries, then the pack family, which every run on a framework
 * picks from. `absent` is each name that is no menu id and no family with an
 * entry.
 */
function pickedFamilies(entries, { frameworks, taskSkills, packFamily }) {
    const ids = new Set(entries.map(entry => entry.id));
    const published = new Set(entries.map(entry => entry.family));
    const named = [...new Set(taskSkills.filter(name => !ids.has(name)))];
    const families = named.filter(name => published.has(name));
    if (frameworks.length > 0) families.push(packFamily);
    return { families: [...new Set(families)], absent: named.filter(name => !published.has(name)) };
}

/** The values a run on `framework` can send for the match key `key`. */
function sentValues(matchKeys, key, framework) {
    const byFramework = Object.hasOwn(matchKeys, key) ? matchKeys[key] : {};
    return Object.hasOwn(byFramework, framework) ? byFramework[framework] : [];
}

/**
 * Every run on `framework` the wizard can send: the framework alone first,
 * then with each value it can give each other match key.
 */
function runsOn(framework, matchKeys) {
    let runs = [{ [FRAMEWORK_KEY]: [framework] }];
    for (const key of Object.keys(matchKeys)) {
        const values = sentValues(matchKeys, key, framework);
        runs = runs.flatMap(run => [run, ...values.map(value => ({ ...run, [key]: [value] }))]);
    }
    return runs;
}

/** Why no pick reaches `entry`. */
function unreachableReason(entry, { frameworks, matchKeys }) {
    const declared = matchKeysOf(entry);
    const served = declared.get(FRAMEWORK_KEY);
    if (!served) return `it has no ${FRAMEWORK_KEY}: tag`;
    const tagged = (key, values) => values.map(value => `${key}:${value}`).join(' or ');
    const detected = served.filter(framework => frameworks.includes(framework));
    if (detected.length === 0) return `the wizard detects no ${tagged(FRAMEWORK_KEY, served)}`;
    for (const [key, values] of declared) {
        if (key === FRAMEWORK_KEY) continue;
        const sent = detected.flatMap(framework => sentValues(matchKeys, key, framework));
        if (!values.some(value => sent.includes(value))) {
            return `the wizard sends no ${tagged(key, values)} with ${tagged(FRAMEWORK_KEY, detected)}`;
        }
    }
    return 'another entry outranks it on every run';
}

/**
 * Check a built skill menu against what the wizard picks with.
 *
 * `absent` lists each task-named skill that is no menu id and no family with
 * an entry. `missing` lists each run that resolves no skill in a picked
 * family, as `{ family, framework }` with the run's other match keys, such as
 * `frameworkVariant: 'pages-router'`. `unreachable` lists each
 * `{ family, id, reason }` of a picked family that no run resolves to; such an
 * entry is still served by its id.
 */
function checkSkillResolvability(menu, { frameworks, matchKeys = {}, taskSkills, packFamily }) {
    const entries = menuEntries(menu);
    const { families, absent } = pickedFamilies(entries, { frameworks, taskSkills, packFamily });
    const missing = [];
    const unreachable = [];
    for (const family of families) {
        const members = entries.filter(entry => entry.family === family);
        const reached = new Set();
        for (const framework of frameworks) {
            const runs = runsOn(framework, matchKeys);
            // A framework that resolves nothing alone resolves nothing with another key, so it is listed once.
            for (const run of resolveSkill(entries, family, runs[0]) ? runs : runs.slice(0, 1)) {
                const pick = resolveSkill(entries, family, run);
                if (pick) reached.add(pick.id);
                else missing.push({ family, ...Object.fromEntries(Object.entries(run).map(([key, [value]]) => [key, value])) });
            }
        }
        for (const entry of members) {
            if (!reached.has(entry.id)) {
                unreachable.push({ family, id: entry.id, reason: unreachableReason(entry, { frameworks, matchKeys }) });
            }
        }
    }
    return { families, absent, missing, unreachable };
}

/** The build error for `absent`: every task-named skill the menu has under no id or family. */
function absentMessage(absent) {
    return [
        'A wizard task names these skills, and the menu has no entry or family for them:',
        ...absent.map(name => `  ${name}`),
        'Publish each skill again, or remove its name from WIZARD_TASK_SKILLS in scripts/lib/wizard-skill-picks.js when no wizard task names it.',
    ].join('\n');
}

/** The build error for `missing`: every family with the runs it resolves nothing for. */
function missingMessage(missing) {
    const byFamily = new Map();
    for (const { family, framework, ...others } of missing) {
        const sent = Object.entries(others).map(([key, value]) => `${key}:${value}`);
        const run = sent.length > 0 ? `${framework} with ${sent.join(' and ')}` : framework;
        byFamily.set(family, [...(byFamily.get(family) ?? []), run]);
    }
    return [
        'A wizard run on these frameworks resolves no skill. Each family needs a menu entry tagged framework:<framework>, with no tag that disagrees with the run:',
        ...[...byFamily].map(([family, runs]) => `  ${family}: ${runs.join(', ')}`),
    ].join('\n');
}

export { resolveSkill, checkSkillResolvability, absentMessage, missingMessage };
