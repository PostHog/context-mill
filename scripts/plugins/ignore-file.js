/**
 * Plugin to ignore entire files marked with @ignoreFile at the start
 * Returns empty string if @ignoreFile is found in the first few lines
 * Supports both line comments and block comments
 */
const ignoreFilePlugin = {
    name: 'ignore-file',
    transform: (content) => {
        // Check first 10 lines for @ignoreFile marker
        const lines = content.split('\n');
        const checkLines = lines.slice(0, 10);

        for (const line of checkLines) {
            // Must be at start of comment: // @ignoreFile is valid, // text @ignoreFile is not
            if (line.match(/(?:\/\/|#|\/\*|<!--)\s*@ignoreFile(?:\s|$|\*\/|-->)/)) {
                return ''; // Return empty to skip entire file
            }
        }

        return content;
    },
};

module.exports = ignoreFilePlugin;
