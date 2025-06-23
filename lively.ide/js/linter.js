/**
 * Methods for running eslint on JS code as well as the linter configuration used in lively.next.
 */

import config from 'eslint-config-standard';
import eslint from 'eslint';

const rules = {
  // These are all rules from the default ruleset that are fixable
  // i.e. the linter will auto-format violations without giving other output than reformatted code
  curly: ['warn', 'multi-line'],
  eqeqeq: ['warn', 'smart'],
  'no-extra-bind': 'warn',
  'no-extra-boolean-cast': 'warn',
  'no-regex-spaces': 'warn',
  'no-undef-init': 'warn',
  'no-unneeded-ternary': ['warn', { defaultAssignment: false }],
  'no-useless-computed-key': 'warn',
  'no-useless-rename': 'warn',
  'no-useless-return': 'warn',
  'no-var': 'warn',
  'one-var': ['warn', { initialized: 'never' }],
  'quote-props': ['warn', 'as-needed'],
  'spaced-comment': ['warn', 'always', {
    line: { markers: ['*package', '!', '/', ',', '='] },
    block: { balanced: true, markers: ['*package', '!', ',', ':', '::', 'flow-include'], exceptions: ['*'] }
  }],
  yoda: ['warn', 'never'],
  'array-bracket-spacing': ['warn', 'never'],
  'arrow-spacing': ['warn', { before: true, after: true }],
  'block-spacing': ['warn', 'always'],
  'brace-style': ['warn', '1tbs', { allowSingleLine: true }],
  'comma-dangle': ['warn', {
    arrays: 'never',
    objects: 'never',
    imports: 'never',
    exports: 'never',
    functions: 'never'
  }],
  'comma-spacing': ['warn', { before: false, after: true }],
  'comma-style': ['warn', 'last'],
  'computed-property-spacing': ['warn', 'never', { enforceForClassMembers: true }],
  'dot-location': ['warn', 'property'],
  'eol-last': 'warn',
  'func-call-spacing': ['warn', 'never'],
  'generator-star-spacing': ['warn', { before: true, after: true }],
  indent: ['warn', 2, {
    SwitchCase: 1,
    VariableDeclarator: 1,
    outerIIFEBody: 1,
    MemberExpression: 1,
    FunctionDeclaration: { parameters: 1, body: 1 },
    FunctionExpression: { parameters: 1, body: 1 },
    CallExpression: { arguments: 1 },
    ArrayExpression: 1,
    ObjectExpression: 1,
    ImportDeclaration: 1,
    flatTernaryExpressions: false,
    ignoreComments: false,
    ignoredNodes: ['TemplateLiteral *', 'JSXElement', 'JSXElement > *', 'JSXAttribute', 'JSXIdentifier', 'JSXNamespacedName', 'JSXMemberExpression', 'JSXSpreadAttribute', 'JSXExpressionContainer', 'JSXOpeningElement', 'JSXClosingElement', 'JSXFragment', 'JSXOpeningFragment', 'JSXClosingFragment', 'JSXText', 'JSXEmptyExpression', 'JSXSpreadChild'],
    offsetTernaryExpressions: true
  }],
  'key-spacing': ['warn', { beforeColon: false, afterColon: true }],
  'keyword-spacing': ['warn', { before: true, after: true }],
  'lines-between-class-members': ['warn', 'always', { exceptAfterSingleLine: true }],
  'linebreak-style': ['warn', 'unix'],
  'multiline-ternary': ['warn', 'always-multiline'],
  'new-parens': 'warn',
  'no-multi-spaces': 'warn',
  'no-multiple-empty-lines': ['warn', { max: 1, maxEOF: 0 }],
  'no-whitespace-before-property': 'warn',
  'object-curly-newline': ['warn', { multiline: true, consistent: true }],
  'object-curly-spacing': ['warn', 'always'],
  'object-property-newline': ['warn', { allowMultiplePropertiesPerLine: true }],
  'operator-linebreak': ['warn', 'after', { overrides: { '?': 'before', ':': 'before', '|>': 'before' } }],
  'padded-blocks': ['warn', { blocks: 'never', switches: 'never', classes: 'never' }],
  quotes: ['warn', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
  'rest-spread-spacing': ['warn', 'never'],
  'semi-spacing': ['warn', { before: false, after: true }],
  'space-before-blocks': ['warn', 'always'],
  'space-before-function-paren': ['warn', 'always'],
  'space-in-parens': ['warn', 'never'],
  'space-infix-ops': 'warn',
  'space-unary-ops': ['warn', { words: true, nonwords: false }],
  // Fixable rules where we changed something opposed to the default config
  semi: ['warn', 'always'],
  'no-extra-semi': 'warn',
  'prefer-const': 'off',
  // These are rules that cannot be automatically fixed, but for which we want to get a warning upon violation
  'no-trailing-spaces': ['warn', { ignoreComments: false }],
  'no-debugger': 'warn',
  'no-unreachable': 'warn',
  'no-const-assign': 'warn',
  'no-unused-vars': 'warn',
  'no-use-before-define': ['error', { functions: true, classes: true, variables: true }],
  'no-constructor-return': 'warn',
  'no-console': 'warn'
};

config.rules = rules;

/**
 * @typedef LinterMessage
 * @type {object}
 * @property {number} column - Starting column the warning was located at.
 * @property {number} endColumn - Ending column the warning was located at.
 * @property {number} line - Starting line the warning was located at.
 * @property {number} endLine - Ending line the warning was located at.
 * @property {string} message - Message that explains the linter violation.
 * @property {string} messageId - Shorthand for the violated linter rule.
 * @property {string} ruleId - Id of the violated rule.
 * @property {string} nodeType - Ast node type at the point of violation.
 * @property {number} severity - Prioritization of the violation.
 */

/**
 * For given source code snippet, returns a linted version of the source code
 * together with a set of generated warnings or violations of the linting rules.
 * We can further provide a custom set of rules that overrides the default
 * rule set for the analysis of the given source code.
 * @param { string } code - The source code to be analyzed and autocorrected.
 * @param { Object } [customRules] - A set of rules to override the default rule set.
 * @returns { Array.<string, LinterMessage[]> }
 */
export default function lint (code, customRules = {}) {
  const linter = new eslint.Linter();
  const linterOutput = linter.verifyAndFix(code, { ...config, rules: { ...config.rules, ...customRules } });
  return [linterOutput.output, linterOutput.messages];
}

export function installLinter (System) {
  System.lint = lint;
}
