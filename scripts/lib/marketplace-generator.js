/**
 * Marketplace Generator
 *
 * Generates a Claude Code plugin marketplace directory from built skills.
 * Groups skills into themed plugins and produces a mega-plugin containing all skills.
 */

const fs = require('fs');
const path = require('path');

/**
 * Mapping from YAML skill group names to plugin names
 */
const GROUP_TO_PLUGIN = {
    'integration-skills': 'posthog-integration',
    'feature-flag-skills': 'posthog-feature-flags',
    'llm-analytics-skills': 'posthog-llm-analytics',
    'logs-skills': 'posthog-logs',
    'other-skills': 'posthog-tools',
};

/**
 * Human-readable display names for plugins
 */
const PLUGIN_DISPLAY_NAMES = {
    'posthog-integration': 'PostHog Integration',
    'posthog-feature-flags': 'PostHog Feature Flags',
    'posthog-llm-analytics': 'PostHog LLM Analytics',
    'posthog-logs': 'PostHog Logs',
    'posthog-tools': 'PostHog Tools',
    'posthog-all': 'PostHog All Skills',
};

/**
 * Plugin descriptions
 */
const PLUGIN_DESCRIPTIONS = {
    'posthog-integration': 'Skills for integrating PostHog analytics into your application',
    'posthog-feature-flags': 'Skills for implementing PostHog feature flags across frameworks',
    'posthog-llm-analytics': 'Skills for monitoring LLM usage with PostHog',
    'posthog-logs': 'Skills for setting up PostHog log capture',
    'posthog-tools': 'Utility skills for working with PostHog (HogQL, etc.)',
    'posthog-all': 'Complete set of all PostHog skills for agents and power users',
};

/**
 * Recursively copy a directory
 */
function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

/**
 * Generate a plugin.json for a plugin directory
 */
function writePluginJson(pluginDir, pluginName, skillEntries, version) {
    const metaDir = path.join(pluginDir, '.claude-plugin');
    fs.mkdirSync(metaDir, { recursive: true });

    const pluginJson = {
        name: pluginName,
        displayName: PLUGIN_DISPLAY_NAMES[pluginName] || pluginName,
        description: PLUGIN_DESCRIPTIONS[pluginName] || '',
        version,
        author: 'PostHog',
        skills: skillEntries.map(s => ({
            id: s.dirName,
            name: s.displayName,
            description: s.description,
        })),
    };

    fs.writeFileSync(
        path.join(metaDir, 'plugin.json'),
        JSON.stringify(pluginJson, null, 2)
    );
}

/**
 * Generate the marketplace directory structure from built skills.
 *
 * @param {Object} options
 * @param {Array} options.skills - Skill metadata array from generateAllSkills()
 * @param {string} options.tempDir - Path to temp directory containing built skill folders
 * @param {string} options.version - Build version string
 * @param {string} options.outputDir - Root output directory (dist/)
 */
function generateMarketplace({ skills, tempDir, version, outputDir }) {
    const marketplaceDir = path.join(outputDir, 'marketplace');
    const pluginsDir = path.join(marketplaceDir, 'plugins');

    // Clean previous marketplace output
    if (fs.existsSync(marketplaceDir)) {
        fs.rmSync(marketplaceDir, { recursive: true, force: true });
    }

    // Group skills by plugin name
    const pluginGroups = {};
    for (const skill of skills) {
        const pluginName = GROUP_TO_PLUGIN[skill.group];
        if (!pluginName) {
            console.warn(`  [WARN] No plugin mapping for group "${skill.group}", skipping ${skill.id}`);
            continue;
        }
        if (!pluginGroups[pluginName]) {
            pluginGroups[pluginName] = [];
        }
        pluginGroups[pluginName].push(skill);
    }

    const allSkillEntries = [];

    // Generate grouped plugins
    for (const [pluginName, groupSkills] of Object.entries(pluginGroups)) {
        const pluginDir = path.join(pluginsDir, pluginName);
        const skillEntries = [];

        for (const skill of groupSkills) {
            const srcDir = path.join(tempDir, skill.id);
            if (!fs.existsSync(srcDir)) {
                console.warn(`  [WARN] Skill directory not found: ${srcDir}`);
                continue;
            }

            // Use shortId as directory name within grouped plugin
            const destDir = path.join(pluginDir, 'skills', skill.shortId);
            copyDirSync(srcDir, destDir);

            const entry = {
                dirName: skill.shortId,
                displayName: skill.displayName,
                description: skill.description,
            };
            skillEntries.push(entry);

            // Also track for mega-plugin (use full namespaced id to avoid collisions)
            allSkillEntries.push({
                dirName: skill.id,
                displayName: skill.displayName,
                description: skill.description,
                srcDir,
            });
        }

        writePluginJson(pluginDir, pluginName, skillEntries, version);
        console.log(`  ✓ ${pluginName} (${skillEntries.length} skills)`);
    }

    // Generate posthog-all mega-plugin
    const allPluginDir = path.join(pluginsDir, 'posthog-all');
    for (const entry of allSkillEntries) {
        const destDir = path.join(allPluginDir, 'skills', entry.dirName);
        copyDirSync(entry.srcDir, destDir);
    }
    writePluginJson(allPluginDir, 'posthog-all', allSkillEntries, version);
    console.log(`  ✓ posthog-all (${allSkillEntries.length} skills)`);

    // Generate top-level marketplace.json
    const allPluginNames = [...Object.keys(pluginGroups), 'posthog-all'];
    const marketplaceMeta = path.join(marketplaceDir, '.claude-plugin');
    fs.mkdirSync(marketplaceMeta, { recursive: true });

    const marketplaceJson = {
        name: 'posthog',
        displayName: 'PostHog',
        description: 'PostHog analytics, feature flags, LLM analytics, and more',
        version,
        plugins: allPluginNames.map(name => ({
            name,
            displayName: PLUGIN_DISPLAY_NAMES[name] || name,
            description: PLUGIN_DESCRIPTIONS[name] || '',
            path: `plugins/${name}`,
        })),
    };

    fs.writeFileSync(
        path.join(marketplaceMeta, 'marketplace.json'),
        JSON.stringify(marketplaceJson, null, 2)
    );

    console.log(`  ✓ marketplace.json (${allPluginNames.length} plugins)`);

    return { marketplaceDir, pluginCount: allPluginNames.length, skillCount: allSkillEntries.length };
}

module.exports = { generateMarketplace };
