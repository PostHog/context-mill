/**
 * Naming-convention enforcement for `cli:` blocks.
 *
 * Kept separate from the skill generator so the validation rules read on their
 * own — see context-mill/CONTRIBUTING.md and the wizard's CONTRIBUTING.md for
 * the rationale. Failures throw at build time, before drift can ship.
 */

export const CLI_ROLES = ['command', 'skill', 'internal'];

const KEBAB_CASE = /^[a-z][a-z0-9-]*$/;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 20;
const RESERVED_WORDS = new Set([
    // yargs reserves these for built-in behavior
    'help',
    'version',
    'completion',
]);
const INTERNAL_FLAG_NAMES = new Set([
    // collisions with the wizard's internal mode flags (see CONTRIBUTING.md)
    'playground',
    'benchmark',
    'yara-report',
    'local-mcp',
    'ci',
    'skill',
]);

/**
 * Validate a `command` / `parentCommand` value: kebab-case, length 2–20, no
 * yargs reserved words, no wizard internal-flag collisions. Throws on failure.
 *
 * @param {string} name
 * @param {string} field  the cli-block field being checked (for error text)
 * @param {string} context  human-readable label for error messages
 */
export function validateCommandName(name, field, context) {
    if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
        throw new Error(
            `${context}: cli.${field} "${name}" must be ${NAME_MIN_LENGTH}–${NAME_MAX_LENGTH} characters`,
        );
    }
    if (!KEBAB_CASE.test(name)) {
        throw new Error(
            `${context}: cli.${field} "${name}" must be kebab-case (lowercase letters, digits, hyphens; start with a letter)`,
        );
    }
    if (RESERVED_WORDS.has(name)) {
        throw new Error(
            `${context}: cli.${field} "${name}" collides with a yargs reserved word (${[...RESERVED_WORDS].join(', ')})`,
        );
    }
    if (INTERNAL_FLAG_NAMES.has(name)) {
        throw new Error(
            `${context}: cli.${field} "${name}" collides with a wizard internal flag (${[...INTERNAL_FLAG_NAMES].join(', ')})`,
        );
    }
}
