/* global describe, it */
import { expect } from 'mocha-es6';
import { Morph } from 'lively.morphic';
import { codeEvaluationCommands } from '../../text/code-evaluation-commands.js';

describe('Print it compatibility', () => {
  for (const [name, value] of [
    ['Date', new Date('2026-01-02T03:04:05Z')], ['Map', new Map([['a', 1]])],
    ['Set', new Set([1])], ['Promise', Promise.resolve(1)], ['Morph', new Morph({name: 'printed'})],
    ['array', [1, 2]], ['string', 'hello']
  ]) {
    it(`preserves the string representation of ${name}`, async () => {
      let printed;
      const editor = {maybeSelectCommentOrLine() {}, selection: {collapseToEnd() {}},
        async doEval() { return {value}; }, insertTextAndSelect(text) { printed = text; }, focus() {}};
      await codeEvaluationCommands.find(command => command.name === 'printit').exec(editor);
      expect(printed).equals(String(value), `${name} must retain the previous Print it output`);
    });
  }
});
