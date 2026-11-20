/**
 * What the wizard picks skills with, stated here because the build cannot
 * import the wizard. The resolvability check reads all three; see
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

export { WIZARD_FRAMEWORKS, WIZARD_TASK_SKILLS, FRAMEWORK_PACK_FAMILY };
