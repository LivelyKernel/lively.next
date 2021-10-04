import { importModuleViaNative } from 'lively.resources';
import config from 'https://jspm.dev/eslint-config-standard';

let eslint;

(async () => {
  // fixme: this can become a normal import once we update babel to babel
  eslint = await importModuleViaNative('https://jspm.dev/eslint');
})();

Object.assign(config.rules, {
  semi: ['error', 'always'],
  'no-extra-semi': 'error',
  'prefer-const': 'off'
});

export default function lint (code) {
  const linter = new eslint.Linter();
  return linter.verifyAndFix(code, config).output;
}
