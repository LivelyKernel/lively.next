import { importModuleViaNative } from "lively.resources";
import config from 'https://jspm.dev/eslint-config-standard';

Object.assign(config.rules, {
  semi: ["error", "always"],
  "no-extra-semi": "error"
});

export default async function lint(code) {
  const eslint = await importModuleViaNative('https://jspm.dev/eslint');
  const linter = new eslint.Linter();
  return linter.verifyAndFix(code, config).output;
}