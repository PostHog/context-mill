/**
 * Marketplace Generator
 *
 * Generates a Claude Code plugin marketplace directory from built skills.
 * Groups skills into themed plugins and produces a mega-plugin containing all skills.
 * Configuration is driven by transformation-config/marketplace.yaml.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Load marketplace config from YAML
 */
function loadMarketplaceConfig(configDir) {
    const configPath = path.join(configDir, 'marketplace.yaml');
    const content = fs.readFileSync(configPath, 'utf8');
    return yaml.load(content);
}

/**
 * Build lookup tables from marketplace config
 */
function buildConfigMaps(config) {
    const groupToPlugin = {};
    const pluginDescriptions = {};
    const pluginKeywords = {};
    const pluginDestinations = {};

    for (const [group, plugin] of Object.entries(config.plugins)) {
        groupToPlugin[group] = plugin.name;
        pluginDescriptions[plugin.name] = plugin.description || '';
        pluginKeywords[plugin.name] = plugin.keywords || ['posthog'];
        pluginDestinations[plugin.name] = plugin.destination;
    }

    // Mega-plugin
    const mega = config.mega_plugin;
    pluginDescriptions[mega.name] = mega.description || '';
    pluginKeywords[mega.name] = mega.keywords || ['posthog'];
    pluginDestinations[mega.name] = mega.destination;

    return { groupToPlugin, pluginDescriptions, pluginKeywords, pluginDestinations };
}

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
function writePluginJson(pluginDir, pluginName, version, { pluginDescriptions, pluginKeywords }) {
    const metaDir = path.join(pluginDir, '.claude-plugin');
    fs.mkdirSync(metaDir, { recursive: true });

    const pluginJson = {
        name: pluginName,
        description: pluginDescriptions[pluginName] || '',
        version,
        author: {
            name: 'PostHog',
        },
        keywords: pluginKeywords[pluginName] || ['posthog'],
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
 * @param {string} options.configDir - Path to transformation-config/
 */
function generateMarketplace({ skills, tempDir, version, outputDir, configDir }) {
    const config = loadMarketplaceConfig(configDir);
    const maps = buildConfigMaps(config);
    const { groupToPlugin, pluginDescriptions, pluginKeywords, pluginDestinations } = maps;

    const marketplaceDir = path.join(outputDir, 'marketplace');
    const pluginsDir = path.join(marketplaceDir, 'plugins');

    // Clean previous marketplace output
    if (fs.existsSync(marketplaceDir)) {
        fs.rmSync(marketplaceDir, { recursive: true, force: true });
    }

    // Group skills by plugin name
    const pluginGroups = {};
    for (const skill of skills) {
        const pluginName = groupToPlugin[skill.category];
        if (!pluginName) {
            console.warn(`  [WARN] No plugin mapping for group "${skill.category}", skipping ${skill.id}`);
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

        for (const skill of groupSkills) {
            const srcDir = path.join(tempDir, skill.id);
            if (!fs.existsSync(srcDir)) {
                console.warn(`  [WARN] Skill directory not found: ${srcDir}`);
                continue;
            }

            const destDir = path.join(pluginDir, 'skills', skill.shortId);
            copyDirSync(srcDir, destDir);

            allSkillEntries.push({
                dirName: skill.id,
                displayName: skill.displayName,
                description: skill.description,
                srcDir,
            });
        }

        writePluginJson(pluginDir, pluginName, version, maps);
        console.log(`  ✓ ${pluginName} (${groupSkills.length} skills)`);
    }

    // Generate mega-plugin
    const megaName = config.mega_plugin.name;
    const megaDir = path.join(pluginsDir, megaName);
    for (const entry of allSkillEntries) {
        const destDir = path.join(megaDir, 'skills', entry.dirName);
        copyDirSync(entry.srcDir, destDir);
    }
    writePluginJson(megaDir, megaName, version, maps);
    if (config.mega_plugin.include_skill_reminder_hook) {
        writeSkillReminderHook(megaDir);
    }
    console.log(`  ✓ ${megaName} (${allSkillEntries.length} skills)`);

    // Generate top-level marketplace.json
    const allPluginNames = [...Object.keys(pluginGroups), megaName];
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
            description: pluginDescriptions[name] || '',
            keywords: pluginKeywords[name] || ['posthog'],
        })),
    };

    fs.writeFileSync(
        path.join(marketplaceMeta, 'marketplace.json'),
        JSON.stringify(marketplaceJson, null, 2)
    );

    console.log(`  ✓ marketplace.json (${allPluginNames.length} plugins)`);

    // Generate push manifest for CI — tells the release workflow what to push where
    // Paths are relative to the dist/ directory so they work in any environment
    const pushManifest = {
        target_repo: config.target_repo,
        plugins: allPluginNames.map(name => ({
            name,
            source: `marketplace/plugins/${name}`,
            destination: pluginDestinations[name],
        })),
    };

    const pushManifestPath = path.join(outputDir, 'push-manifest.json');
    fs.writeFileSync(pushManifestPath, JSON.stringify(pushManifest, null, 2));
    console.log(`  ✓ push-manifest.json (${allPluginNames.length} entries)`);

    return { marketplaceDir, pluginCount: allPluginNames.length, skillCount: allSkillEntries.length };
}

module.exports = { generateMarketplace };
