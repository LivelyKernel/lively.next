/* global describe, it */
import { expect } from 'mocha-es6';
import { Color } from 'lively.graphics';
import { codeEvaluationCommands } from '../../text/code-evaluation-commands.js';

const printit = codeEvaluationCommands.find(command => command.name === 'printit');

/**
 * @param {Function} doEval - Answers the evaluation result of the editor.
 * @returns {object} An editor that records the text that Print it inserts.
 */
function editorEvaluating (doEval) {
  const editor = {
    inserted: null,
    doEval,
    selection: { collapseToEnd () {} },
    maybeSelectCommentOrLine () {},
    insertTextAndSelect (text) { editor.inserted = text; },
    focus () {}
  };
  return editor;
}

describe('print it', () => {
  it('prints a value as its string representation', async () => {
    const editor = editorEvaluating(async () => ({ value: new Map([['a', 1]]) }));
    await printit.exec(editor);
    expect(editor.inserted).equals('[object Map]');
  });

  it('prints the error of an evaluation that throws', async () => {
    const error = new Error('evaluation failed');
    const editor = editorEvaluating(async () => { throw error; });
    await printit.exec(editor);
    expect(editor.inserted).equals(String(error) + '\n' + error.stack);
  });

  it('prints a color that was thrown as an error instead of previewing it', async () => {
    const editor = editorEvaluating(async () => ({ isError: true, value: Color.red }));
    await printit.exec(editor);
    expect(editor.inserted).equals(String(Color.red));
  });
});
