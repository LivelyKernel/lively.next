/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv, World } from '../index.js';
import { Text } from '../text/morph.js';
import { Range } from '../text/range.js';
import { pt } from 'lively.graphics';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import * as changes from '../changes/index.js';

/** Return the original thrown value, including incomplete recovery diagnostics. */
function failureOf (callback) {
  try { callback(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('morphic typed text transactions', function () {
  this.timeout(10000);
  let env, manager;
  beforeEach(async () => {
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    await env.setWorld(new World({ extent: pt(600, 400) }));
    manager = env.changeManager;
  });
  afterEach(() => MorphicEnv.popDefault().uninstall());
  const text = (value = 'hello\nworld') => new Text({ readOnly: false, textString: value, fixedWidth: true, fixedHeight: true, extent: pt(400, 200) });

  it('captures text and prior attributes before document mutation', () => {
    const target = text('abcd');
    target.addTextAttribute({ fontWeight: 'bold' }, Range.create(0, 1, 0, 3));
    const original = target.document.replace;
    let before;
    target.document.replace = function (...args) {
      const entry = manager._atomicFrame.journal.find(entry => entry.operation.kind === 'replace-text');
      expect(entry).to.be.ok;
      before = entry.operation.before;
      return original.apply(this, args);
    };
    const result = manager.transaction({ scope: target }, () => target.replace(Range.create(0, 1, 0, 3), 'XY', false));
    expect(before).deep.equals(['bc', { fontWeight: 'bold' }]);
    expect(result.changeSet.operations).to.have.length(1);
    expect(result.changeSet.operations[0]).to.be.instanceOf(changes.ReplaceText);
    expect(target.textString).equals('aXYd');
    env.undoManager.undo();
    expect(target.textAndAttributes).deep.equals(['a', null, 'bc', { fontWeight: 'bold' }, 'd', null]);
    env.undoManager.redo();
    expect(target.textString).equals('aXYd');
  });

  it('does not snapshot unrelated full documents during typing or retain snapshots in history', () => {
    const target = text('x'.repeat(60000));
    // Exclude renderer font scans from this capture-only read count.
    Object.defineProperty(target, 'canBeMeasuredViaCanvas', { get: () => false });
    const getter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'textAndAttributes').get;
    let reads = 0;
    Object.defineProperty(target, 'textAndAttributes', { configurable: true, get () { reads++; return getter.call(this); } });
    for (let i = 0; i < 5; i++) {
      manager.transaction({ scope: target }, () => target.insertText('a', { row: 0, column: i }, false));
    }
    expect(reads).equals(0);
    const operations = env.undoManager.undos.flatMap(entry => entry.changeSet.operations);
    expect(operations).to.have.length(5);
    expect(operations.every(operation => operation.before.join('').length < 10 && operation.after[0] === 'a')).equals(true);
  });

  it('normalizes committed text once without retaining the compatibility snapshot', () => {
    const target = text('abcd');
    const seen = [];
    manager.addCommittedChangeListener((view, context) => seen.push({ view, context }), { containsMorph: m => m === target });
    manager.addCommittedChangeListener((view, context) => seen.push({ view, context }), { containsMorph: m => m === target });
    const result = manager.transaction({ scope: target }, () => {
      target.insertText('X', { row: 0, column: 1 }, false);
      target.insertText('Y', { row: 0, column: 2 }, false);
    });
    expect(seen).to.have.length(2);
    expect(seen[0].view).equals(seen[1].view);
    expect(seen[0].context).equals(seen[1].context);
    const operation = seen[0].view.operations[0];
    expect(seen[0].view.operations).to.have.length(1);
    expect(operation).to.be.instanceOf(changes.SetMorphProperty);
    expect(operation.before).deep.equals(['abcd', null]);
    expect(operation.after).deep.equals(['aXYbcd', null]);
    expect(operation.metadata.textReplacement).equals(true);
    expect(seen[0].context.capturedChangeSet).equals(result.changeSet);
    expect(result.history.entry.changeSet).equals(result.changeSet);
    expect(result.changeSet.operations).to.have.length(2);
    expect(Object.values(result.history.entry).includes(seen[0].view)).equals(false);
  });

  it('keeps a full textAndAttributes assignment canonical, including embedded structure', () => {
    const target = text('before');
    const embedded = morph();
    const result = manager.transaction({ scope: target }, () => { target.textAndAttributes = ['A', { fontWeight: 'bold' }, embedded, null, 'B', null]; });
    expect(result.changeSet.operations).to.have.length(1);
    expect(result.changeSet.operations[0].kind).equals('replace-text');
    expect(embedded.owner).equals(target);
    env.undoManager.undo();
    expect(target.textString).equals('before');
    expect(embedded.owner).equals(null);
    env.undoManager.redo();
    expect(target.textAndAttributes[2]).equals(embedded);
    expect(embedded.owner).equals(target);
    expect(target.embeddedMorphMap.get(embedded).anchor).to.be.ok;
  });

  for (const edit of ['add', 'remove', 'style', 'sorted', 'reset']) {
    it(`captures exact prior attributes for ${edit} range edits`, () => {
      const target = text('abcd');
      target.addTextAttribute({ fontWeight: 'bold', fontSize: 20 }, Range.create(0, 1, 0, 3));
      const before = target.textAndAttributes;
      const range = Range.create(0, 1, 0, 3);
      const result = manager.transaction({ scope: target }, () => {
        if (edit === 'add') target.addTextAttribute({ fontWeight: 'normal' }, range);
        if (edit === 'remove') target.removeTextAttribute({ fontWeight: true }, range);
        if (edit === 'style') target.setStyleInRange({ fontStyle: 'italic' }, range);
        if (edit === 'sorted') target.setTextAttributesWithSortedRanges([range, { fontStyle: 'italic' }]);
        if (edit === 'reset') target.resetTextAttributes();
      });
      const after = target.textAndAttributes;
      expect(result.changeSet.operations).to.have.length(1);
      expect(result.changeSet.operations[0].kind).equals('replace-text');
      env.undoManager.undo();
      expect(target.textAndAttributes).deep.equals(before);
      env.undoManager.redo();
      expect(target.textAndAttributes).deep.equals(after);
    });
  }

  it('supports full assignment on a static text without adding a document', () => {
    const target = new Text({ textString: 'abcd', fixedWidth: true, fixedHeight: true, extent: pt(400, 200) });
    expect(target.document).equals(undefined);
    const result = manager.transaction({ scope: target }, () => { target.textAndAttributes = ['XY', { fontWeight: 'bold' }]; });
    expect(result.changeSet.operations).to.have.length(1);
    expect(target.document).equals(undefined);
    env.undoManager.undo();
    expect(target.textString).equals('abcd');
    env.undoManager.redo();
    expect(target.textString).equals('XY');
  });

  it('keeps a static text document upgrade and embedding in one canonical edit', () => {
    const target = new Text({ textString: 'abcd', fixedWidth: true, fixedHeight: true });
    const embedded = morph();
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    const siblings = parent.submorphs.slice();
    const result = manager.transaction({ scope: [target, parent] }, () => { target.textAndAttributes = ['A', null, embedded, null]; });
    expect(result.changeSet.operations).to.have.length(1);
    expect(result.changeSet.operations[0].kind).equals('replace-text');
    expect(embedded.owner).equals(target);
    env.undoManager.undo();
    expect(target.textString).equals('abcd');
    expect(parent.submorphs).deep.equals(siblings);
    env.undoManager.redo();
    expect(embedded.owner).equals(target);
  });

  it('recovers a partially completed static text document upgrade', () => {
    const target = new Text({ textString: 'abcd', fixedWidth: true, fixedHeight: true });
    const document = target.document;
    const layout = target.textLayout;
    const embedded = morph();
    const parent = morph({ submorphs: [embedded] });
    const original = target.backWithDocument;
    const cause = new Error('after document upgrade');
    target.backWithDocument = function () { original.call(this); this.backWithDocument = original; throw cause; };
    expect(failureOf(() => manager.transaction({ scope: [target, parent] }, () => { target.textAndAttributes = [embedded, null]; }))).equals(cause);
    expect(target.document).equals(document);
    expect(target.textLayout).equals(layout);
    expect(target.needsDocument).equals(false);
    expect(target.textString).equals('abcd');
    expect(embedded.owner).equals(parent);
  });

  it('preserves outer text edits while rolling back a failed savepoint', () => {
    const target = text('abcd');
    const cause = new Error('savepoint');
    const result = manager.transaction({ scope: target }, () => {
      target.insertText('X', { row: 0, column: 1 }, false);
      expect(failureOf(() => manager.transaction({ scope: target }, () => {
        target.deleteText(Range.create(0, 1, 0, 3));
        throw cause;
      }))).equals(cause);
      expect(target.textString).equals('aXbcd');
      target.insertText('Y', { row: 0, column: 2 }, false);
    });
    expect(result.changeSet.operations).to.have.length(2);
    expect(target.textString).equals('aXYbcd');
    env.undoManager.undo();
    expect(target.textString).equals('abcd');
  });

  it('rejects cross-environment text before mutating its document', () => {
    const target = text('abcd');
    const foreign = new MorphicEnv(env.domEnv);
    try {
      const cause = failureOf(() => foreign.changeManager.transaction({ undoable: false }, () => target.insertText('X', { row: 0, column: 1 }, false)));
      expect(cause.name).equals('MorphicTransactionUnsupportedError');
      expect(cause.kind).equals('cross-environment');
      expect(target.textString).equals('abcd');
    } finally { foreign.uninstall(); }
  });

  it('does not grant text observers a direct-state permit', () => {
    const target = text('abcd');
    const original = target.onChange;
    const violations = [];
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace') violations.push(failureOf(() => { this._morphicState.opacity = 0.3; }));
    };
    const cause = failureOf(() => manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 1 }, false)));
    expect(cause).equals(violations[0]);
    expect(cause.name).equals('MorphicTransactionUnsupportedError');
    expect(violations).to.have.length(2);
    expect(violations.every(error => error.name === 'MorphicTransactionUnsupportedError')).equals(true);
    expect(target.textString).equals('abcd');
    expect(target.opacity).equals(1);
  });

  it('captures auto-fit reactions and replays them without duplicate embedded position entries', () => {
    const target = new Text({ readOnly: false, textString: 'abcd' });
    const embedded = morph({ position: pt(13, 17) });
    const parent = morph({ submorphs: [embedded] });
    const result = manager.transaction({ scope: [target, parent] }, () => target.insertText([embedded, null], { row: 0, column: 2 }, false));
    expect(result.changeSet.operations.filter(operation => operation.targetId === embedded.id)).to.have.length(0);
    env.undoManager.undo();
    expect(target.textString).equals('abcd');
    expect(embedded.owner).equals(parent);
    expect(embedded.position).equals(pt(13, 17));
    env.undoManager.redo();
    expect(embedded.owner).equals(target);
  });

  it('reports incomplete text recovery without masking the original error', () => {
    const target = text('abcd');
    const cause = new Error('edit failed');
    const inverse = new Error('document cannot be restored');
    const original = target.document.replace;
    const failure = failureOf(() => manager.transaction({ scope: target }, () => {
      target.insertText('X', { row: 0, column: 1 }, false);
      target.document.replace = () => { throw inverse; };
      throw cause;
    }));
    target.document.replace = original;
    expect(failure).to.be.instanceOf(changes.MorphicRollbackError);
    expect(failure.cause).equals(cause);
    expect(failure.rollbackErrors.some(pair => pair.operation.kind === 'replace-text' && pair.error === inverse)).equals(true);
    expect(failure.unreversedOperations.some(operation => operation.kind === 'replace-text')).equals(true);
    expect(Object.hasOwn(manager, '_record')).equals(false);
  });

  it('leaves direct Document mutations outside the supported Text API boundary', () => {
    const target = text('abcd');
    const result = manager.transaction({ scope: target }, () => target.document.insertText('X', { row: 0, column: 1 }));
    expect(result.changeSet.operations).to.have.length(0);
    expect(target.textString).equals('aXbcd');
  });

  it('captures the existing multiline undo and redo selection ranges as frozen data', () => {
    const target = text();
    target.selection = Range.create(0, 1, 1, 3);
    const result = manager.transaction({ scope: target }, () => target.replace(Range.create(0, 1, 1, 3), 'X\nY', false));
    const payload = result.history.entry.textReplay;
    expect(payload).deep.equals([{ targetId: target.id, undoRange: Range.create(0, 1, 1, 3).toLiteral(), redoRange: Range.create(0, 1, 1, 1).toLiteral() }]);
    expect(Object.isFrozen(payload)).equals(true);
    expect(Object.isFrozen(payload[0].undoRange.start)).equals(true);
  });

  it('restores text, attributes, selection, anchors and embedded ownership after a partial document update', () => {
    const target = text('abcd');
    target.addTextAttribute({ fontWeight: 'bold' }, Range.create(0, 1, 0, 3));
    const embedded = morph({ position: pt(13, 17) });
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    const siblings = parent.submorphs.slice();
    target.selection = Range.create(0, 1, 0, 3);
    const anchor = target.addAnchor({ id: 'saved', row: 0, column: 3 });
    const anchors = target.anchors.slice();
    const selection = target.selection.toString();
    const before = target.textAndAttributes;
    const cause = new Error('after document removal');
    const original = target.document.insertTextAndAttributes;
    target.document.insertTextAndAttributes = function (...args) { this.insertTextAndAttributes = original; throw cause; };
    const failure = failureOf(() => manager.transaction({ scope: [target, parent] }, () => {
      target.replace(Range.create(0, 1, 0, 3), [embedded, null], false);
    }));
    expect(failure).equals(cause);
    expect(target.textAndAttributes).deep.equals(before);
    expect(target.selection.toString()).equals(selection);
    expect(target.anchors).deep.equals(anchors);
    expect(anchor.position).deep.equals({ row: 0, column: 3 });
    expect(parent.submorphs).deep.equals(siblings);
    expect(embedded.position).equals(pt(13, 17));
    expect(embedded.owner).equals(parent);
  });

  it('restores existing embedded anchors and selection after a failed post-document update', () => {
    const target = text('abcd');
    const embedded = morph();
    target.insertText([embedded, null], { row: 0, column: 2 }, false);
    const anchor = target.embeddedMorphMap.get(embedded).anchor;
    const before = target.textAndAttributes;
    target.selection = Range.create(0, 1, 0, 4);
    const selection = target.selection.toString();
    const original = target._updateEmbeddedMorphsDuringReplace;
    const cause = new Error('after embedded update');
    target._updateEmbeddedMorphsDuringReplace = function (...args) { original.apply(this, args); this._updateEmbeddedMorphsDuringReplace = original; throw cause; };
    const failure = failureOf(() => manager.transaction({ scope: target }, () => target.deleteText(Range.create(0, 1, 0, 4))));
    expect(failure).equals(cause);
    expect(target.textAndAttributes).deep.equals(before);
    expect(target.embeddedMorphMap.get(embedded).anchor).equals(anchor);
    expect(target.anchors.includes(anchor)).equals(true);
    expect(target.selection.toString()).equals(selection);
    expect(embedded.owner).equals(target);
  });

  it('replays the semantic receipt and compact set with identical external attachments and sibling order', () => {
    const target = text('abcd');
    const embedded = morph({ position: pt(13, 17), rotation: 0.25, scale: 1.5 });
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    const nonText = morph({ name: 'non-text' });
    target.addMorph(nonText);
    const before = parent.submorphs.slice();
    const transform = embedded.getTransform().copy();
    let receipt;
    manager.addCommittedChangeListener((view, context) => { receipt = { view, context }; }, { containsMorph: m => m === target });
    const result = manager.transaction({ scope: [target, parent] }, () => target.insertText([embedded, null], { row: 0, column: 2 }, false));
    const original = receipt;
    const afterText = target.textAndAttributes;
    const afterChildren = target.submorphs.slice();
    manager.applyChangeSet(original.view, { context: original.context, direction: 'undo' });
    expect(parent.submorphs).deep.equals(before);
    expect(embedded.getTransform()).deep.equals(transform);
    expect(target.submorphs).deep.equals([nonText]);
    manager.applyChangeSet(result.changeSet, { context: original.context, direction: 'redo' });
    expect(target.textAndAttributes).deep.equals(afterText);
    expect(target.submorphs).deep.equals(afterChildren);
    manager.applyChangeSet(result.changeSet, { context: original.context, direction: 'undo' });
    expect(parent.submorphs).deep.equals(before);
    manager.applyChangeSet(original.view, { context: original.context, direction: 'redo' });
    expect(target.textAndAttributes).deep.equals(afterText);
    expect(target.submorphs).deep.equals(afterChildren);
  });

  it('rejects semantic replay without the matching commit identity and token', () => {
    const target = text('abcd');
    const receipts = [];
    manager.addCommittedChangeListener((view, context) => receipts.push({ view, context }), { containsMorph: m => m === target });
    manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 1 }, false));
    manager.transaction({ scope: target }, () => target.insertText('Y', { row: 0, column: 2 }, false));
    for (const context of [undefined, manager.operationContext({ scope: target }), receipts[1].context, { ...receipts[0].context, commitToken: {} }]) {
      const failure = failureOf(() => manager.applyChangeSet(receipts[0].view, { context, direction: 'undo' }));
      expect(failure.name).equals('MorphicSemanticViewReplayError');
      expect(target.textString).equals('aXYbcd');
    }
  });

  it('rolls back an auto-fit text event to its exact text and fitted extent', () => {
    const target = new Text({ readOnly: false, textString: 'abcd' });
    const before = target.extent.copy();
    const cause = new Error('failed auto-fit event');
    expect(failureOf(() => manager.transaction({ scope: target }, () => {
      target.insertText('X', { row: 0, column: 2 }, false);
      expect(target.extent.equals(before)).equals(false);
      throw cause;
    }))).equals(cause);
    expect(target.textString).equals('abcd');
    expect(target.getProperty('extent')).equals(before);
    expect(env.undoManager.undos).to.have.length(0);
  });

  for (const exit of ['success', 'error', 'thenable']) {
    it(`restores the ordinary fit method after a text transaction ${exit}`, () => {
      const target = text('abcd');
      const descriptor = Object.getOwnPropertyDescriptor(Text.prototype, 'fit');
      const cause = new Error('text fit lifetime');
      const run = () => manager.transaction({ scope: target }, () => {
        target.insertText('X', { row: 0, column: 2 }, false);
        expect(Text.prototype.fit).not.equals(descriptor.value);
        if (exit === 'error') throw cause;
        if (exit === 'thenable') return Promise.reject(cause);
      });
      if (exit === 'success') run();
      else {
        const error = failureOf(run);
        if (exit === 'error') expect(error).equals(cause);
        else expect(error.name).equals('MorphicTransactionAsyncError');
      }
      expect(Object.getOwnPropertyDescriptor(Text.prototype, 'fit')).deep.equals(descriptor);
      expect(Object.hasOwn(target, 'fit')).equals(false);
    });
  }

  it('keeps delayed fitting with a successful text savepoint during outer rollback', () => {
    const target = new Text({ readOnly: false, textString: 'abcd' });
    const before = target.extent.copy();
    const descriptor = Object.getOwnPropertyDescriptor(Text.prototype, 'fit');
    const cause = new Error('outer text event');
    expect(failureOf(() => manager.transaction({ scope: target }, () => {
      manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 2 }, false));
      expect(Text.prototype.fit).not.equals(descriptor.value);
      expect(target.extent.equals(before)).equals(false);
      throw cause;
    }))).equals(cause);
    expect(target.textString).equals('abcd');
    expect(target.getProperty('extent')).equals(before);
    expect(Object.getOwnPropertyDescriptor(Text.prototype, 'fit')).deep.equals(descriptor);
  });

  it('characterizes direct semantic change-set replay as lossy for an external attachment', () => {
    const target = text('abcd');
    const embedded = morph();
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    let receipt;
    manager.addCommittedChangeListener((view, context) => { receipt = { view, context }; }, { containsMorph: m => m === target });
    manager.transaction({ scope: [target, parent] }, () => target.insertText([embedded, null], { row: 0, column: 2 }, false));
    const context = { resolveMorph: id => id === target.id ? target : null, setMorphProperty: (m, p, v) => { m[p] = v; } };
    receipt.view.invert().apply(context);
    expect(target.textString).equals('abcd');
    expect(embedded.owner).equals(null);
  });
});
