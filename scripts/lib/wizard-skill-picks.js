/**
 * What the wizard picks skills with, stated here because the build cannot
 * import the wizard. The resolvability check reads all four; see
 * "The resolvability check" in the README. Keep each in step with its source.
 */

/** Every framework a run can detect: the `Integration` enum in the wizard's `src/shared/constants.ts`. */
const WIZARD_FRAMEWORKS = [
    'nextjs',
    'nuxt',
    'vue',
    'react-router',
    'tanstack-start',
    'tanstack-router',
    'react-native',
    'angular',
    'astro',
    'django',
    'flask',
    'fastapi',
    'laravel',
    'sveltekit',
    'flutter',
    'kmp',
    'swift',
    'android',
    'rails',
    'elixir',
    'go',
    'rust',
    'java',
    'python',
    'ruby',
    'javascript_web',
    'javascript_node',
];

/**
 * Every other match key a run can send, with the values each framework can
 * give it: the traits with `matchKey: true` in the wizard's
 * `src/services/project-discovery/traits/registry.ts`. `frameworkVariant` is
 * each framework's `getVariant` in `src/services/frameworks/<framework>/`.
 * Nuxt's is its major version, so it lists each major in use.
 */
const WIZARD_MATCH_KEYS = {
    frameworkVariant: {
        nextjs: ['app-router', 'pages-router'],
        nuxt: ['3.x', '4.x'],
        'react-router': ['v6', 'v7-framework', 'v7-data', 'v7-declarative'],
        'tanstack-router': ['file-based', 'code-based'],
        'react-native': ['expo', 'react-native'],
        astro: ['static', 'ssr', 'hybrid', 'view-transitions'],
    },
};

/** Every skill a task names, a menu id or a skill family: the `skills:` frontmatter of the wizard's `src/programs/<program>/agent/<task>.md`. */
const WIZARD_TASK_SKILLS = [
    'integration-build',
    'integration-capture',
    'integration-dashboard',
    'integration-error-tracking',
    'integration-feature-flags',
    'integration-identify',
    'integration-init',
    'integration-insight',
    'integration-install',
    'integration-mcp',
    'integration-notebook',
    'integration-report',
    'integration-session-replay',
    'integration-warehouse',
    'posthog-best-practices',
    'replay-vision-scanner-flow-outcome',
    'replay-vision-scanner-problems',
    'replay-vision-scanner-session-summaries',
    'replay-vision-scanners-core',
    'spend-audit-code-fixes',
    'spend-audit-errors',
    'spend-audit-events',
    'spend-audit-findings',
    'spend-audit-flags',
    'spend-audit-groups',
    'spend-audit-identify',
    'spend-audit-insights',
    'spend-audit-notebook',
    'spend-audit-queries',
    'spend-audit-replay',
    'spend-audit-result',
];

/** The family a run's framework pack is picked from: `FRAMEWORK_PACK_FAMILY` in the wizard's `src/agent/runner/sequence/orchestrator/repackaged-skills.ts`. */
const FRAMEWORK_PACK_FAMILY = 'integration';

export { WIZARD_FRAMEWORKS, WIZARD_MATCH_KEYS, WIZARD_TASK_SKILLS, FRAMEWORK_PACK_FAMILY };
