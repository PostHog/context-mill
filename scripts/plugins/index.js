/**
 * Plugin system for content transformation
 */

import ignoreLinePlugin from './ignore-line.js';
import ignoreFilePlugin from './ignore-file.js';
import ignoreBlockPlugin from './ignore-block.js';

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

export {
    composePlugins,
    ignoreLinePlugin,
    ignoreFilePlugin,
    ignoreBlockPlugin,
};
