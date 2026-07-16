/**
 * Release-asset manifest checks.
 *
 * A published release must carry every asset its menus point at: each menu file
 * itself, plus every `downloadUrl` its entries reference. The wizard fetches
 * these by exact URL at startup, so a missing one is a hard runtime failure —
 * see PostHog/wizard#912, where agent-menu.json and its prompts were built but
 * never uploaded, so `wizard-orchestrator` died with repeated HTTP 404s.
 *
 * These helpers are pure so they can be unit tested; verify-release-assets.js
 * wires them to a real release's asset list.
 */

/** The asset filename a downloadUrl resolves to (its last path segment). */
export function assetNameFromUrl(url) {
    return url.split('/').pop();
}

/**
 * Every asset filename a menu implies: the menu file itself plus each entry's
 * downloadUrl basename. `entries` is the flat list of `{ downloadUrl }` objects
 * a menu carries (agent-menu.json's `agents`, or skill-menu.json's categories
 * flattened).
 */
export function expectedAssetsForMenu(menuFileName, entries) {
    const names = new Set([menuFileName]);
    for (const entry of entries) {
        if (entry?.downloadUrl) names.add(assetNameFromUrl(entry.downloadUrl));
    }
    return names;
}

/** Expected asset names not present in the actual release asset list. */
export function findMissingAssets(expected, actual) {
    const have = new Set(actual);
    return [...expected].filter((name) => !have.has(name)).sort();
}
