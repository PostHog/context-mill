/**
 * Additive comparison
 *
 * Whether a candidate value holds everything a baseline value does, unchanged.
 * `check-bundle-diff --additive` uses it on the JSON a build publishes.
 */

/** The field that names an element of a list of records, so two lists compare record by record. */
const recordKey = list =>
    ['id', 'skillId'].find(key => list.length > 0 && list.every(item => item && typeof item === 'object' && typeof item[key] === 'string'));

/** Whether `candidate` holds everything `baseline` does, unchanged. What only the candidate has goes to `added`. */
function contains(baseline, candidate, at, out, added) {
    if (Array.isArray(baseline) && Array.isArray(candidate)) {
        // An empty list has nothing to keep, so all the candidate lists is added.
        if (baseline.length === 0) {
            candidate.forEach((item, i) => added.push(`${at}[${recordKey(candidate) ? item[recordKey(candidate)] : i}]`));
            return;
        }
        const key = recordKey(baseline);
        if (!key || recordKey(candidate) !== key) {
            if (JSON.stringify(baseline) !== JSON.stringify(candidate)) out.push(at);
            return;
        }
        const byKey = new Map(candidate.map(item => [item[key], item]));
        for (const item of baseline) {
            if (!byKey.has(item[key])) out.push(`${at}[${item[key]}] (removed)`);
            else contains(item, byKey.get(item[key]), `${at}[${item[key]}]`, out, added);
        }
        const known = new Set(baseline.map(item => item[key]));
        for (const item of candidate) if (!known.has(item[key])) added.push(`${at}[${item[key]}]`);
        return;
    }
    const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (isRecord(baseline) && isRecord(candidate)) {
        for (const key of Object.keys(baseline)) {
            if (!(key in candidate)) out.push(`${at}.${key} (removed)`);
            else contains(baseline[key], candidate[key], `${at}.${key}`, out, added);
        }
        for (const key of Object.keys(candidate)) if (!(key in baseline)) added.push(`${at}.${key}`);
        return;
    }
    if (JSON.stringify(baseline) !== JSON.stringify(candidate)) out.push(at);
}

export { contains, recordKey };
