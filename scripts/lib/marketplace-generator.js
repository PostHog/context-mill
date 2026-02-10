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
    'integration': 'posthog-integration',
    'feature-flags': 'posthog-feature-flags',
    'llm-analytics': 'posthog-llm-analytics',
    'logs': 'posthog-logs',
    'tools-and-features': 'posthog-tools',
};

/**
 * Plugin keywords for discovery
 */
const PLUGIN_KEYWORDS = {
    'posthog-integration': ['posthog', 'analytics', 'integration', 'tracking'],
    'posthog-feature-flags': ['posthog', 'feature-flags', 'experiments', 'ab-testing'],
    'posthog-llm-analytics': ['posthog', 'llm', 'ai', 'observability'],
    'posthog-logs': ['posthog', 'logs', 'logging', 'observability'],
    'posthog-tools': ['posthog', 'hogql', 'analytics', 'tools'],
    'posthog-all': ['posthog', 'analytics', 'feature-flags', 'llm', 'logs'],
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
function writePluginJson(pluginDir, pluginName, version) {
    const metaDir = path.join(pluginDir, '.claude-plugin');
    fs.mkdirSync(metaDir, { recursive: true });

    const pluginJson = {
        name: pluginName,
        description: PLUGIN_DESCRIPTIONS[pluginName] || '',
        version,
        author: {
            name: 'PostHog',
        },
        keywords: PLUGIN_KEYWORDS[pluginName] || ['posthog'],
    };

    fs.writeFileSync(
        path.join(metaDir, 'plugin.json'),
        JSON.stringify(pluginJson, null, 2)
    );
}

/**
 * Write a UserPromptSubmit hook into a plugin that reminds the agent to check skills.
 */
function writeSkillReminderHook(pluginDir) {
    const hooksDir = path.join(pluginDir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });

    const hooksJson = {
        hooks: {
            UserPromptSubmit: [
                {
                    hooks: [
                        {
                            type: 'command',
                            command: '${CLAUDE_PLUGIN_ROOT}/hooks/skill-reminder.sh',
                        },
                    ],
                },
            ],
        },
    };

    fs.writeFileSync(
        path.join(hooksDir, 'hooks.json'),
        JSON.stringify(hooksJson, null, 2)
    );

    const script = `#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "<IMPORTANT>\\nBefore responding, check if any of your PostHog skills apply to this task. Your available skills are listed in your system context. If a skill is relevant and has not been activated in this session, use the Skill tool to activate it.\\n</IMPORTANT>"
  }
}
EOF
`;

    const scriptPath = path.join(hooksDir, 'skill-reminder.sh');
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, 0o755);
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
        const pluginName = GROUP_TO_PLUGIN[skill.category];
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

        writePluginJson(pluginDir, pluginName, version);
        console.log(`  ✓ ${pluginName} (${skillEntries.length} skills)`);
    }

    // Generate posthog-all mega-plugin
    const allPluginDir = path.join(pluginsDir, 'posthog-all');
    for (const entry of allSkillEntries) {
        const destDir = path.join(allPluginDir, 'skills', entry.dirName);
        copyDirSync(entry.srcDir, destDir);
    }
    writePluginJson(allPluginDir, 'posthog-all', version);
    writeSkillReminderHook(allPluginDir);
    console.log(`  ✓ posthog-all (${allSkillEntries.length} skills)`);

    // Generate top-level marketplace.json
    const allPluginNames = [...Object.keys(pluginGroups), 'posthog-all'];
    const marketplaceMeta = path.join(marketplaceDir, '.claude-plugin');
    fs.mkdirSync(marketplaceMeta, { recursive: true });

    const marketplaceJson = {
        name: 'posthog',
        owner: {
            name: 'PostHog',
        },
        metadata: {
            description: 'PostHog analytics, feature flags, LLM analytics, and more',
            version,
        },
        plugins: allPluginNames.map(name => ({
            name,
            source: `./plugins/${name}`,
            description: PLUGIN_DESCRIPTIONS[name] || '',
            keywords: PLUGIN_KEYWORDS[name] || ['posthog'],
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
