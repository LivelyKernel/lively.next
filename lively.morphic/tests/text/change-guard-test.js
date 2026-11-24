/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv, World } from '../../index.js';
import { Text } from '../../text/morph.js';
import { Range } from '../../text/range.js';
import { pt } from 'lively.graphics';
import { createDOMEnvironment } from '../../rendering/dom-helper.js';

/** Keep the thrown error so rollback failures cannot count as a clean rejection. */
function failureOf (callback) {
  try { callback(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('text plugin change guards', function () {
  this.timeout(10000);
  let env, target;

  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
    await env.setWorld(new World({ extent: pt(600, 400) }));
    target = new Text({ readOnly: false, textString: 'abLOCKcd', fixedWidth: true, fixedHeight: true, extent: pt(400, 200) });
  });

  afterEach(async () => { await MorphicEnv.popDefault().uninstall(); });

  const range = (start, end = start) => Range.create(0, start, 0, end);
  const protectMiddle = () => target.addPlugin({
    isTextChangeAllowed (changed) {
      return changed.start.column >= 6 || changed.end.column <= 2;
    }
  });

  it('keeps unguarded replacement, whole assignment, attributes and undo working', () => {
    target.addPlugin({});
    target.replace(range(2, 6), 'open');
    expect(target.textString).equals('abopencd');
    target.textUndo();
    expect(target.textString).equals('abLOCKcd');
    target.textRedo();
    expect(target.textString).equals('abopencd');
    target.textAndAttributes = ['styled', { fontWeight: 'bold' }];
    target.textString = 'plain';
    expect(target.textAndAttributes).deep.equals(['plain', null]);
    target.textString = null;
    expect(target.textString).equals('');
  });

  it('requires every plugin to allow a change and only false cancels it', () => {
    target.addPlugin({ isTextChangeAllowed: () => undefined });
    target.addPlugin({ isTextChangeAllowed: () => true });
    const denying = target.addPlugin({ isTextChangeAllowed: () => false });
    target.insertText('X', { row: 0, column: 0 });
    expect(target.textString).equals('abLOCKcd');
    target.removePlugin(denying);
    target.insertText('X', { row: 0, column: 0 });
    expect(target.textString).equals('XabLOCKcd');
  });

  it('preserves trailing newlines during whole-string assignment and text undo/redo', () => {
    const before = 'first\nsecond';
    const after = 'one\ntwo\nthree\n';
    target.textString = before;
    target.undoManager.reset();
    target.textString = after;
    expect(target.textString).equals(after);
    target.textUndo();
    expect(target.textString).equals(before);
    target.textRedo();
    expect(target.textString).equals(after);
  });

  it('rejects replacement, insertion and overlapping deletion before mutation or history', () => {
    protectMiddle();
    const blocked = target.replace(range(3, 5), 'replacement');
    expect(blocked.equals(range(3))).equals(true);
    target.insertText('insert', { row: 0, column: 3 });
    target.deleteText(range(1, 7));
    expect(target.textString).equals('abLOCKcd');
    expect(target.undoManager.undos).to.have.length(0);
    target.replace(range(6, 8), 'outside');
    expect(target.textString).equals('abLOCKoutside');
  });

  it('routes a rich text paste through the same guard', () => {
    protectMiddle();
    target.selection = range(3, 5);
    target.onPaste({
      stop () {},
      domEvt: {
        clipboardData: {
          getData (type) {
            if (type === 'application/x-lively-text') return JSON.stringify({ textAndAttributes: ['paste', { fontWeight: 'bold' }] });
            return 'paste';
          }
        }
      }
    });
    expect(target.textString).equals('abLOCKcd');
    expect(target.undoManager.undos).to.have.length(0);
  });

  it('preflights whole text assignments before clearing content or its stored attributes', () => {
    target.textAndAttributes = ['abLOCKcd', { fontWeight: 'bold' }];
    target.undoManager.reset();
    const before = target.textAndAttributes;
    const stored = target.getProperty('textAndAttributes');
    const anchor = target.addAnchor({ row: 0, column: 4 });
    protectMiddle();
    target.textString = 'replacement';
    target.textAndAttributes = ['replacement', { fontStyle: 'italic' }];
    expect(target.textAndAttributes).deep.equals(before);
    expect(target.getProperty('textAndAttributes')).equals(stored);
    expect(anchor.position).deep.equals({ row: 0, column: 4 });
    expect(target.undoManager.undos).to.have.length(0);
  });

  it('authorizes a whole string replacement without first attempting an intermediate deletion', () => {
    target.addPlugin({ isTextChangeAllowed: (changed, replacement) => typeof replacement === 'string' && replacement.length > 0 });
    target.textString = 'complete replacement';
    expect(target.textString).equals('complete replacement');
    expect(target.undoManager.undos).to.have.length(1);
  });

  it('preflights static text assignments before a document upgrade or embedding', () => {
    const label = new Text({ textString: 'before', fixedWidth: true, fixedHeight: true });
    const child = morph();
    const seen = [];
    label.addPlugin({ isTextChangeAllowed: (changed) => { seen.push(changed); return false; } });
    label.textAndAttributes = [child, null];
    label.textString = 'after';
    expect(label.textString).equals('before');
    expect(label.document).equals(undefined);
    expect(label.needsDocument).equals(false);
    expect(child.owner).equals(null);
    expect(seen.every(changed => new Range(changed).equals(range(0, 6)))).equals(true);
  });

  it('rejects a transaction atomically and can compensate after the plugin begins denying edits', () => {
    let denying = false;
    target.addPlugin({
      isTextChangeAllowed (changed, replacement) {
        if (replacement === 'blocked') denying = true;
        return !denying;
      }
    });
    const cause = failureOf(() => env.changeManager.transaction({ scope: target }, () => {
      target.insertText('allowed', { row: 0, column: 8 }, false);
      target.replace(range(3, 5), 'blocked', false);
    }));
    expect(cause.name).equals('Error');
    expect(cause.message).equals('Text change rejected by a text plugin');
    expect(target.textString).equals('abLOCKcd');
    expect(env.undoManager.undos).to.have.length(0);
  });

  for (const assignment of ['textString', 'textAndAttributes']) {
    it(`rejects a transactional ${assignment} assignment without keeping earlier property edits`, () => {
      protectMiddle();
      const cause = failureOf(() => env.changeManager.transaction({ scope: target }, () => {
        target.opacity = 0.4;
        target[assignment] = assignment === 'textString' ? 'replacement' : ['replacement', null];
      }));
      expect(cause.message).equals('Text change rejected by a text plugin');
      expect(target.textString).equals('abLOCKcd');
      expect(target.opacity).equals(1);
      expect(env.undoManager.undos).to.have.length(0);
    });
  }

  it('does not let typed redo bypass a newly installed guard or keep an earlier replayed edit', () => {
    env.changeManager.transaction({ scope: target }, () => {
      target.opacity = 0.4;
      target.replace(range(2, 6), 'open', false);
    });
    env.undoManager.undo();
    protectMiddle();
    const cause = failureOf(() => env.undoManager.redo());
    expect(cause.message).equals('Text change rejected by a text plugin');
    expect(target.textString).equals('abLOCKcd');
    expect(target.opacity).equals(1);
  });

  it('does not let typed undo bypass a newly installed guard or leave partially reversed state', () => {
    env.changeManager.transaction({ scope: target }, () => {
      target.replace(range(2, 6), 'open', false);
      target.opacity = 0.4;
    });
    protectMiddle();
    const cause = failureOf(() => env.undoManager.undo());
    expect(cause.message).equals('Text change rejected by a text plugin');
    expect(target.textString).equals('abopencd');
    expect(target.opacity).equals(0.4);
  });
});
