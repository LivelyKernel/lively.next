/* global describe, it, System */
import { expect } from 'mocha-es6';

describe('live Object Editor dependencies', function () {
  this.timeout(120000);

  it('imports and opens the Object Editor and lints with the live module', async function () {
    if (System.get('@system-env').node) return this.skip();
    const { open } = await System.import('lively.ide/js/objecteditor/ui.cp.js');
    const { default: lint } = await System.import('lively.ide/js/linter.js');
    const win = await open({});
    try {
      expect(win.targetMorph.viewModel.isObjectEditor).equals(true);
      const [formatted, messages] = lint('const unused={answer:42}\ndebugger');
      expect(formatted).equals('const unused = { answer: 42 };\ndebugger;\n');
      expect(messages.map(message => message.ruleId).sort()).deep.equals(['no-debugger', 'no-unused-vars']);
    } finally {
      win.remove();
    }
  });
});
