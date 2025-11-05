/**
 * Plugin system for content transformation
 */

const ignoreLinePlugin = require('./ignore-line');
const ignoreFilePlugin = require('./ignore-file');
const ignoreBlockPlugin = require('./ignore-block');

/**
 * Compose multiple plugins into a single transformation function
 * Plugins are applied in order (left to right)
 * Short-circuits and returns empty string if content becomes empty
 *
 * @param {Array} plugins - Array of plugins to compose
 * @returns {function(string, Object): string} - Composed transformation function
 */
function composePlugins(plugins = []) {
    return (content, context) => {
        return plugins.reduce((transformedContent, plugin) => {
            // Short-circuit if content is already empty
            if (!transformedContent || transformedContent.trim() === '') {
                return transformedContent;
            }

            try {
                return plugin.transform(transformedContent, context);
            } catch (error) {
                console.error(`Error in plugin '${plugin.name}':`, error.message);
                // Return content as-is if plugin fails
                return transformedContent;
            }
        }, content);
    };
}

module.exports = {
    composePlugins,
    ignoreLinePlugin,
    ignoreFilePlugin,
    ignoreBlockPlugin,
};
