#!/usr/bin/env node

/**
 * Generates the copyable PostHog browser snippet embedded in example apps.
 *
 * Keep method lists and asset URL behavior in the target configuration below.
 * The executable snippet itself has one source so security fixes cannot drift
 * between framework examples.
 */
import fs from 'fs';
import path from 'path';

const START_MARKER = '// POSTHOG_BROWSER_SNIPPET_START';
const END_MARKER = '// POSTHOG_BROWSER_SNIPPET_END';

const ASTRO_METHODS =
    'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId';

const FLUTTER_METHODS =
    'capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagResult reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId';

const WORDPRESS_METHODS =
    'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug';

const RAILS_METHODS =
    'init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId';

export const EMBEDDED_BROWSER_SNIPPETS = [
    {
        file: 'example-apps/astro-hybrid/src/components/posthog.astro',
        methods: ASTRO_METHODS,
    },
    {
        file: 'example-apps/astro-ssr/src/components/posthog.astro',
        methods: ASTRO_METHODS,
    },
    {
        file: 'example-apps/astro-static/src/components/posthog.astro',
        methods: ASTRO_METHODS,
    },
    {
        file: 'example-apps/astro-view-transitions/src/components/posthog.astro',
        methods: ASTRO_METHODS,
    },
    {
        file: 'example-apps/flutter/web/index.html',
        methods: FLUTTER_METHODS,
    },
    {
        file: 'example-apps/ruby-on-rails/app/views/layouts/application.html.erb',
        methods: RAILS_METHODS,
        rewriteIngestionHost: true,
    },
    {
        file: 'example-apps/wordpress/posthog-example/posthog-example.php',
        methods: WORDPRESS_METHODS,
        rewriteIngestionHost: true,
    },
];

export function generateBrowserSnippet({ methods, rewriteIngestionHost = false }) {
    const assetUrl = rewriteIngestionHost
        ? 's.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js"'
        : 's.api_host+"/static/array.js"';

    return `!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=${assetUrl},(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="${methods}".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);`;
}

export function renderEmbeddedBrowserSnippet(content, target) {
    const lines = content.split('\n');
    const startIndexes = lines.flatMap((line, index) =>
        line.trim() === START_MARKER ? [index] : [],
    );
    const endIndexes = lines.flatMap((line, index) =>
        line.trim() === END_MARKER ? [index] : [],
    );

    if (startIndexes.length !== 1 || endIndexes.length !== 1) {
        throw new Error(
            `${target.file} must contain exactly one ${START_MARKER} and ${END_MARKER}`,
        );
    }

    const start = startIndexes[0];
    const end = endIndexes[0];
    if (end <= start) {
        throw new Error(`${target.file} has browser snippet markers in the wrong order`);
    }

    const indentation = lines[start].match(/^\s*/)[0];
    lines.splice(start + 1, end - start - 1, indentation + generateBrowserSnippet(target));
    return lines.join('\n');
}

export function syncEmbeddedBrowserSnippets(repoRoot, { check = false } = {}) {
    const stale = [];

    for (const target of EMBEDDED_BROWSER_SNIPPETS) {
        const filePath = path.join(repoRoot, target.file);
        const current = fs.readFileSync(filePath, 'utf8');
        const generated = renderEmbeddedBrowserSnippet(current, target);
        if (generated === current) continue;

        stale.push(target.file);
        if (!check) fs.writeFileSync(filePath, generated);
    }

    return stale;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
    const check = process.argv.includes('--check');
    const repoRoot = path.join(import.meta.dirname, '..');
    const stale = syncEmbeddedBrowserSnippets(repoRoot, { check });

    if (check && stale.length > 0) {
        console.error(`Browser snippets are stale:\n${stale.map(file => `  - ${file}`).join('\n')}`);
        console.error('Run pnpm generate:browser-snippets to update them.');
        process.exit(1);
    }

    console.log(
        stale.length === 0
            ? 'All embedded browser snippets are current.'
            : `Updated ${stale.length} embedded browser snippets.`,
    );
}
