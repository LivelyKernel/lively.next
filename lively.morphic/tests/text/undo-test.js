/* global System, it, describe, xdescribe, beforeEach */
import { promise } from 'lively.lang';
import { Text } from '../../text/morph.js';

import { expect, chai } from 'mocha-es6';
import { expectSelection } from '../test-helpers.js';

let describeInBrowser = System.get('@system-env').browser
  ? describe
  : (title, fn) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xdescribe(title, fn); };

expectSelection(chai);

import config from '../../config.js';

let text;

describeInBrowser('undo', function () {
  this.timeout(config.text.undoGroupDelay * 2);

  beforeEach(() => text = new Text({
    readOnly: false,
    textString: 'hello\nworld',
    cursorPosition: { row: 0, column: 0 },
    readOnly: false
  }));

  it('can undo simple insert', () => {
    text.insertText('foo', { row: 1, column: 0 });
    expect(text.textString).equals('hello\nfooworld');
    text.textUndo();
    expect(text.textString).equals('hello\nworld');
    expect(text.selection).selectionEquals('Selection(1/0 -> 1/0)');
  });

  it('can undo and redo insert', () => {
    text.insertText('foo', { row: 1, column: 0 });
    text.textUndo();
    text.textRedo();
    expect(text.textString).equals('hello\nfooworld');
    expect(text.selection).selectionEquals('Selection(1/0 -> 1/3)');
  });

  it('can undo and redo delete', () => {
    text.textString = 'foo bar';
    text.deleteText({ start: { row: 0, column: 4 }, end: { row: 0, column: 7 } });
    expect(text.textString).equals('foo ');
    text.textUndo();
    expect(text.textString).equals('foo bar');
    expect(text.selection).selectionEquals('Selection(0/4 -> 0/7)');
    text.textRedo();
    expect(text.textString).equals('foo ');
    expect(text.selection).selectionEquals('Selection(0/4 -> 0/4)');
  });

  it('undo then redo', () => {
    text.insertText('foo', { row: 1, column: 0 });
    text.insertText(' bar', { row: 1, column: 3 });
    expect(text.textString).equals('hello\nfoo barworld');

    text.textUndo(); text.textUndo();
    text.textRedo(); text.textRedo();
    expect(text.textString).equals('hello\nfoo barworld');
    expect(text.selection).selectionEquals('Selection(1/3 -> 1/7)');
  });

  it('groups undos', () => {
    text.cursorPosition = { row: 1, column: 5 };
    expect(text.undoManager.undos).have.length(0);
    text.undoManager.group();
    text.insertText('a'); text.insertText('b'); text.insertText('c');
    text.undoManager.group();
    expect(text.undoManager.undos).have.length(1);
    text.textUndo();
    expect(text.textString).equals('hello\nworld');
    text.textRedo();
    expect(text.textString).equals('hello\nworldabc');
    expect(text.selection).selectionEquals('Selection(1/5 -> 1/8)');
  });

  it('groups debounced', async () => {
    text.undoManager.group();
    text.insertText('a');
    text.undoManager.groupLater();
    setTimeout(() => text.insertText('b'), 5);
    setTimeout(() => text.insertText('c'), 10);
    await promise.delay(text.undoManager.grouping.debounceTime);
    expect(text.undoManager.undos).have.length(1);
  });

  it('groups debounced cancel', async () => {
    text.undoManager.group();
    text.insertText('a');
    text.undoManager.groupLater();
    setTimeout(() => text.insertText('b'), 5);
    setTimeout(() => text.insertText('c'), 10);
    setTimeout(() => text.undoManager.groupLaterCancel(), 15);
    await promise.delay(text.undoManager.grouping.debounceTime);
    expect(text.undoManager.undos).have.length(3);
  });

  it('creates a new undo group and does stuff with it', () => {
    let undo = text.undoManager.ensureNewGroup(text);
    expect(text.undoManager.undos).equals([undo], 'pre undos');
    expect(text.undoManager.grouping.current).equals([undo], 'pre grouping');
    text.insertText('a');
    text.insertText('b');
    text.undoManager.group(undo);
    expect(text.undoManager.undos[0]).equals(undo, 'undo not in undos');
    expect(text.undoManager.undos).to.have.length(1, 'undos');
    expect(text.undoManager.undos[0].changes).to.have.length(2, 'changes');
    expect(text.undoManager.undos[0]).containSubset(
      { changes: [{ selector: 'replace' }, { selector: 'replace' }] }, 'change details');
  });

  it('can group previous undo', () => {
    // text = new Text({textString: "hello\nworld", fontMetric})
    text.undoManager.group();
    text.insertText('a');
    text.undoManager.group();
    text.insertText('b');
    text.undoManager.group(text.undoManager.undos[0]);
    expect(text.undoManager.undos).to.have.length(1);
    expect(text.undoManager.undos[0].changes).to.have.length(2);
    expect(text.undoManager.undos[0]).containSubset(
      { changes: [{ selector: 'replace' }, { selector: 'replace' }] });
  });

  it('ignores non-text changes', () => {
    // text = new Text({textString: "hello\nworld", fontMetric})
    text.undoManager.group();
    text.insertText('a');
    text.addMarker({ id: 'fooo' });
    text.undoManager.group();
    expect(text.undoManager.undos).to.have.length(1);
    expect(text.undoManager.undos[0].changes).to.have.length(1);
    expect(text.undoManager.undos[0]).containSubset({ changes: [{ selector: 'replace' }] });
  });

  it('new line delete undo', () => {
    text.textString = 'aaa\nbbb';
    text.undoManager.reset();
    text.deleteText({ start: { row: 0, column: 3 }, end: { row: 1, column: 0 } });
    text.undoManager.undo();
    expect(text.textString).equals('aaa\nbbb');
  });
});
