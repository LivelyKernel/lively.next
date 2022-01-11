import { importModuleViaNative } from 'lively.resources';
import config from 'https://jspm.dev/eslint-config-standard';

let eslint;

(async () => {
  // fixme: this can become a normal import once we update babel to babel
  eslint = await importModuleViaNative('https://jspm.dev/eslint@7.32.0');
})();

const rules = {
  // These are all rules from the default ruleset that are fixable
  // i.e. the linter will auto-format violations without giving other output than reformatted code
  curly: ['error', 'multi-line'],
  eqeqeq: ['error', 'smart'],
  'no-extra-bind': 'error',
  'no-extra-boolean-cast': 'error',
  'no-regex-spaces': 'error',
  'no-undef-init': 'error',
  'no-unneeded-ternary': ['error', { defaultAssignment: false }],
  'no-useless-computed-key': 'error',
  'no-useless-rename': 'error',
  'no-useless-return': 'error',
  'no-var': 'warn',
  'one-var': ['error', { initialized: 'never' }],
  'prefer-const': ['error', { destructuring: 'all' }],
  'quote-props': ['error', 'as-needed'],
  'spaced-comment': ['error', 'always', {
    line: { markers: ['*package', '!', '/', ',', '='] },
    block: { balanced: true, markers: ['*package', '!', ',', ':', '::', 'flow-include'], exceptions: ['*'] }
  }],
  yoda: ['error', 'never'],
  'array-bracket-spacing': ['error', 'never'],
  'arrow-spacing': ['error', { before: true, after: true }],
  'block-spacing': ['error', 'always'],
  'brace-style': ['error', '1tbs', { allowSingleLine: true }],
  'comma-dangle': ['error', {
    arrays: 'never',
    objects: 'never',
    imports: 'never',
    exports: 'never',
    functions: 'never'
  }],
  'comma-spacing': ['error', { before: false, after: true }],
  'comma-style': ['error', 'last'],
  'computed-property-spacing': ['error', 'never', { enforceForClassMembers: true }],
  'dot-location': ['error', 'property'],
  'eol-last': 'error',
  'func-call-spacing': ['error', 'never'],
  'generator-star-spacing': ['error', { before: true, after: true }],
  indent: ['error', 2, {
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
  'key-spacing': ['error', { beforeColon: false, afterColon: true }],
  'keyword-spacing': ['error', { before: true, after: true }],
  'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
  'multiline-ternary': ['error', 'always-multiline'],
  'new-parens': 'error',
  'no-multi-spaces': 'error',
  'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
  'no-whitespace-before-property': 'error',
  'object-curly-newline': ['error', { multiline: true, consistent: true }],
  'object-curly-spacing': ['error', 'always'],
  'object-property-newline': ['error', { allowMultiplePropertiesPerLine: true }],
  'operator-linebreak': ['error', 'after', { overrides: { '?': 'before', ':': 'before', '|>': 'before' } }],
  'padded-blocks': ['error', { blocks: 'never', switches: 'never', classes: 'never' }],
  quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }],
  'rest-spread-spacing': ['error', 'never'],
  'semi-spacing': ['error', { before: false, after: true }],
  'space-before-blocks': ['error', 'always'],
  'space-before-function-paren': ['error', 'always'],
  'space-in-parens': ['error', 'never'],
  'space-infix-ops': 'error',
  'space-unary-ops': ['error', { words: true, nonwords: false }],
  // Fixable rules where we changed something opposed to the default config
  semi: ['error', 'always'],
  'no-extra-semi': 'error',
  'prefer-const': 'off',
  // These are rules that cannot be automatically fixed, but for which we want to get a warning upon violation
  'no-debugger': 'warn',
  'no-unreachable': 'warn',
  'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '_' }]
};

config.rules = rules;

export default function lint (code) {
  const linter = new eslint.Linter();
  const linterOutput = linter.verifyAndFix(code, config);
  return [linterOutput.output, linterOutput.messages];
}
