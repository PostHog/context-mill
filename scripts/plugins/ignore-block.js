/**
 * Plugin to remove blocks of code marked with @ignoreBlock
 * Removes all lines between @ignoreBlockStart and @ignoreBlockEnd (inclusive)
 * Supports both line comments and block comments
 */
const ignoreBlockPlugin = {
    name: 'ignore-block',
    transform: (content) => {
        const lines = content.split('\n');
        const result = [];
        let insideIgnoreBlock = false;

        for (const line of lines) {
            // Check for block start marker (must be at start of comment)
            if (line.match(/(?:\/\/|#|\/\*|<!--)\s*@ignoreBlockStart(?:\s|$|\*\/|-->)/)) {
                insideIgnoreBlock = true;
                continue;
            }

            // Check for block end marker (must be at start of comment)
            if (line.match(/(?:\/\/|#|\/\*|<!--)\s*@ignoreBlockEnd(?:\s|$|\*\/|-->)/)) {
                insideIgnoreBlock = false;
                continue;
            }

            // Skip lines inside ignore block
            if (insideIgnoreBlock) {
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    },
};

module.exports = ignoreBlockPlugin;