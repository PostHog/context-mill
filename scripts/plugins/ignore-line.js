/**
 * Plugin to remove lines marked with @ignoreLine comment
 * Removes both the @ignoreLine comment and the following line
 * Supports both line comments and block comments
 */
const ignoreLinePlugin = {
    name: 'ignore-line',
    transform: (content) => {
        const lines = content.split('\n');
        const result = [];
        let skipNext = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if this line should be skipped due to previous @ignoreLine
            if (skipNext) {
                skipNext = false;
                continue;
            }

            // Check if line ends with comment and @ignoreLine directive
            // Valid: code // @ignoreLine, code # @ignoreLine
            // Invalid: code // text @ignoreLine (must be at start of comment)
            if (line.match(/(?:\/\/|#|\/\*|<!--)\s*@ignoreLine(?:\s|$|\*\/|-->)/)) {
                skipNext = true;
                continue;
            }

            result.push(line);
        }

        return result.join('\n');
    },
};

module.exports = ignoreLinePlugin;
