/* global describe, it, beforeEach, afterEach */
import { expect } from 'mocha-es6';
import { morph, MorphicEnv, World } from '../index.js';
import { Text } from '../text/morph.js';
import { Range } from '../text/range.js';
import { pt } from 'lively.graphics';
import { defaultDOMEnv } from '../rendering/dom-helper.js';
import { MorphicRollbackError } from '../changes/index.js';

/** Preserve the thrown error identity when checking complete and incomplete recovery. */
function failureOf (callback) {
  try { callback(); } catch (error) { return error; }
  throw new Error('Expected a failure');
}

describe('same-Text source-unit composition', function () {
  this.timeout(10000);
  let env, manager;
  let previousWorld;
  beforeEach(async () => {
    previousWorld = globalThis.$world;
    env = MorphicEnv.pushDefault(new MorphicEnv(await defaultDOMEnv()));
    await env.setWorld(new World({ extent: pt(600, 400) }));
    manager = env.changeManager;
  });
  afterEach(() => {
    try { MorphicEnv.popDefault().uninstall(); }
    finally { globalThis.$world = previousWorld; }
  });
  const text = value => new Text({ readOnly: false, textString: value, fixedWidth: true, fixedHeight: true, extent: pt(400, 200) });
  const cases = [
    { name: 'disjoint edits', before: 'abcd', source: t => t.insertText('X', { row: 0, column: 1 }, false), reaction: t => t.insertText('Y', { row: 0, column: 4 }, false), after: 'aXbcYd' },
    { name: 'overlapping edits', before: 'abcd', source: t => t.replace(Range.create(0, 1, 0, 3), 'XYZ', false), reaction: t => t.replace(Range.create(0, 2, 0, 4), 'Q', false), after: 'aXQd' },
    { name: 'a reaction before the source position', before: 'abcd', source: t => t.insertText('X', { row: 0, column: 3 }, false), reaction: t => t.insertText('Y', { row: 0, column: 0 }, false), after: 'YabcXd' },
    { name: 'multiline edits', before: 'ab\ncd\nef', source: t => t.replace(Range.create(0, 1, 1, 1), 'X\nY', false), reaction: t => t.insertText('Q\nR', { row: 2, column: 1 }, false), after: 'aX\nYd\neQ\nRf' },
    { name: 'mixed deletion and insertion', before: 'abcdef', source: t => t.deleteText(Range.create(0, 1, 0, 3)), reaction: t => t.insertText('XYZ', { row: 0, column: 3 }, false), after: 'adeXYZf' }
  ];
  for (const example of cases) {
    for (const mode of ['undo/redo', 'rollback']) {
      it(`composes ${example.name} for ${mode}`, () => {
        const target = text(example.before);
        const original = target.onChange;
        let reacted = false;
        target.onChange = function (change) {
          original.call(this, change);
          if (change.selector !== 'replace' || reacted) return;
          reacted = true;
          example.reaction(this);
        };
        const cause = new Error('failed text unit');
        const run = () => manager.transaction({ scope: target }, () => {
          example.source(target);
          expect(target.textString).equals(example.after);
          if (mode === 'rollback') throw cause;
        });
        if (mode === 'rollback') {
          expect(failureOf(run)).equals(cause);
          expect(target.textString).equals(example.before);
          expect(env.undoManager.undos).to.have.length(0);
        } else {
          const result = run();
          expect(result.changeSet.operations.filter(op => op.kind === 'replace-text')).to.have.length(2);
          for (let cycle = 0; cycle < 5; cycle++) {
            env.undoManager.undo();
            expect(target.textString).equals(example.before);
            env.undoManager.redo();
            expect(target.textString).equals(example.after);
          }
          expect(env.undoManager.undos).to.have.length(1);
        }
      });
    }
  }

  it('restores a partial document failure inside a derived edit, with original error identity', () => {
    const target = text('abcdef');
    const original = target.onChange;
    const cause = new Error('derived insertion failed after removal');
    let reacted = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector !== 'replace' || reacted) return;
      reacted = true;
      const insert = this.document.insertTextAndAttributes;
      this.document.insertTextAndAttributes = function () { this.insertTextAndAttributes = insert; throw cause; };
      this.replace(Range.create(0, 4, 0, 6), 'Y', false);
    };
    const error = console.error;
    const logged = [];
    console.error = (...args) => logged.push(args);
    try {
      expect(failureOf(() => manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 1 }, false)))).equals(cause);
    } finally { console.error = error; }
    expect(logged).to.have.length(1);
    expect(String(logged[0][0])).includes('Error in informMorph');
    expect(String(logged[0][0])).includes(cause.message);
    expect(target.textString).equals('abcdef');
    expect(env.undoManager.undos).to.have.length(0);
  });

  it('keeps attributes and anchors in the untouched gap over repeated exact replay', () => {
    const target = text('abcdef');
    target.addTextAttribute({ fontWeight: 'bold' }, Range.create(0, 2, 0, 4));
    const before = target.textAndAttributes;
    const anchor = target.addAnchor({ id: 'gap', row: 0, column: 3 });
    const original = target.onChange;
    let reacted = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace' && !reacted) { reacted = true; this.insertText('Y', { row: 0, column: 0 }, false); }
    };
    manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 5 }, false));
    const after = target.textAndAttributes;
    expect(anchor.position).deep.equals({ row: 0, column: 4 });
    for (let cycle = 0; cycle < 5; cycle++) {
      env.undoManager.undo();
      expect(target.textAndAttributes).deep.equals(before);
      expect(anchor.position).deep.equals({ row: 0, column: 3 });
      env.undoManager.redo();
      expect(target.textAndAttributes).deep.equals(after);
      expect(anchor.position).deep.equals({ row: 0, column: 4 });
    }
  });

  it('restores selection and embedded ownership receipts across a disjoint failed unit', () => {
    const target = text('abcdef');
    const embedded = morph({ position: pt(13, 17), rotation: 0.25, scale: 1.5 });
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    const siblings = parent.submorphs.slice();
    const transform = embedded.getTransform().copy();
    target.selection = Range.create(0, 2, 0, 4);
    const selection = target.selection.toString();
    const anchors = target.anchors.slice();
    const positions = anchors.map(anchor => ({ ...anchor.position }));
    const cause = new Error('embedded derived edit');
    const original = target.onChange;
    let reacted = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace' && !reacted) { reacted = true; this.insertText([embedded, null], { row: 0, column: 0 }, false); }
    };
    expect(failureOf(() => manager.transaction({ scope: [target, parent] }, () => {
      target.insertText('X', { row: 0, column: 5 }, false);
      throw cause;
    }))).equals(cause);
    expect(target.textString).equals('abcdef');
    expect(target.selection.toString()).equals(selection);
    expect(target.anchors).deep.equals(anchors);
    expect(target.anchors.map(anchor => anchor.position)).deep.equals(positions);
    expect(parent.submorphs).deep.equals(siblings);
    expect(embedded.getTransform()).deep.equals(transform);
    expect(embedded.owner).equals(parent);
  });

  it('reports a non-convergent same-Text reaction with C3 diagnostics', () => {
    const target = text('abcd');
    const original = target.onChange;
    let busy = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector !== 'replace' || busy) return;
      busy = true;
      try { this.insertText('Y', { row: 0, column: 0 }, false); } finally { busy = false; }
    };
    const cause = new Error('non-convergent text unit');
    const failure = failureOf(() => manager.transaction({ scope: target }, () => {
      target.insertText('X', { row: 0, column: 3 }, false);
      throw cause;
    }));
    expect(failure).to.be.instanceOf(MorphicRollbackError);
    expect(failure.cause).equals(cause);
    expect(failure.unreversedOperations.some(operation => operation.kind === 'replace-text')).equals(true);
    expect(failure.rollbackErrors.some(pair => pair.operation.kind === 'replace-text')).equals(true);
  });

  it('repairs replay-created disjoint text edits in the same covering span', () => {
    const target = text('abcdef');
    const original = target.onChange;
    let budget = 1;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace' && budget-- > 0) this.insertText('Y', { row: 0, column: 0 }, false);
    };
    manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 5 }, false));
    for (let cycle = 0; cycle < 5; cycle++) {
      budget = 1;
      env.undoManager.undo();
      expect(target.textString).equals('abcdef');
      budget = 1;
      env.undoManager.redo();
      expect(target.textString).equals('YabcdeXf');
    }
  });

  it('restores replay-only Text properties to their pre-replay content', () => {
    const target = text('abcd');
    const source = morph();
    const original = source.onChange;
    source.onChange = function (change) {
      original.call(this, change);
      if (change.prop === 'opacity' && this.opacity === 1) target.insertText('Y', { row: 0, column: 0 }, false);
    };
    manager.transaction({ scope: [source, target] }, () => { source.opacity = 0.5; });
    for (let cycle = 0; cycle < 5; cycle++) {
      env.undoManager.undo();
      expect(target.textString).equals('abcd');
      env.undoManager.redo();
      expect(target.textString).equals('abcd');
    }
  });

  it('preserves the legacy per-edit selection and anchor outcomes during covering-span replay', () => {
    const target = text('abcdef');
    const legacy = text('abcdef');
    target.selection = legacy.selection = Range.create(0, 2, 0, 4);
    const anchor = target.addAnchor({ id: 'inside', row: 0, column: 3 });
    const legacyAnchor = legacy.addAnchor({ id: 'inside', row: 0, column: 3 });
    const original = target.onChange;
    let reacted = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace' && !reacted) { reacted = true; this.deleteText(Range.create(0, 0, 0, 3)); }
    };
    const result = manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 5 }, false));
    const edits = result.changeSet.operations.filter(operation => operation.kind === 'replace-text');
    const applyLegacy = operation => legacy.replace(new Range(operation.range), operation.after, false, true, false);
    edits.forEach(applyLegacy);
    for (let cycle = 0; cycle < 5; cycle++) {
      env.undoManager.undo();
      edits.slice().reverse().map(operation => operation.invert()).forEach(applyLegacy);
      expect(target.textAndAttributes).deep.equals(legacy.textAndAttributes);
      expect(target.selection.toString()).equals(legacy.selection.toString());
      expect(anchor.position).deep.equals(legacyAnchor.position);
      env.undoManager.redo();
      edits.forEach(applyLegacy);
      expect(target.textAndAttributes).deep.equals(legacy.textAndAttributes);
      expect(target.selection.toString()).equals(legacy.selection.toString());
      expect(anchor.position).deep.equals(legacyAnchor.position);
    }
  });

  it('replays composed embeddings with exact foreign siblings, transforms and non-text child order', () => {
    const target = text('abcdef');
    const nonText = morph({ name: 'non-text child' });
    target.addMorph(nonText);
    const embedded = morph({ position: pt(13, 17), rotation: 0.25, scale: 1.5 });
    const parent = morph({ submorphs: [morph(), embedded, morph()] });
    const siblings = parent.submorphs.slice();
    const transform = embedded.getTransform().copy();
    const original = target.onChange;
    let reacted = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace' && !reacted) { reacted = true; this.insertText([embedded, null], { row: 0, column: 0 }, false); }
    };
    manager.transaction({ scope: [target, parent] }, () => target.insertText('X', { row: 0, column: 5 }, false));
    const after = target.textAndAttributes;
    const children = target.submorphs.slice();
    for (let cycle = 0; cycle < 5; cycle++) {
      env.undoManager.undo();
      expect(target.textString).equals('abcdef');
      expect(parent.submorphs).deep.equals(siblings);
      expect(embedded.getTransform()).deep.equals(transform);
      expect(target.submorphs).deep.equals([nonText]);
      env.undoManager.redo();
      expect(target.textAndAttributes).deep.equals(after);
      expect(target.submorphs).deep.equals(children);
      expect(target.embeddedMorphMap.get(embedded).anchor.position).deep.equals({ row: 0, column: 0 });
    }
  });

  it('recovers an interrupted multiline document primitive from its own untouched suffix', () => {
    const target = text('ab\ncd\nef\ngh');
    const original = target.document.remove;
    const cause = new Error('multiline primitive failed after a partial line update');
    target.document.remove = function (...args) {
      original.apply(this, args);
      this.remove = original;
      throw cause;
    };
    expect(failureOf(() => manager.transaction({ scope: target }, () => target.replace(Range.create(0, 1, 2, 1), 'X\nY', false)))).equals(cause);
    expect(target.textString).equals('ab\ncd\nef\ngh');
  });

  it('keeps an embedded morph inside the untouched gap in its source unit', () => {
    const target = text('abcdef');
    const embedded = morph();
    target.insertText([embedded, null], { row: 0, column: 3 }, false);
    const nonText = morph();
    target.addMorph(nonText);
    const before = target.textAndAttributes;
    const children = target.submorphs.slice();
    const anchor = target.embeddedMorphMap.get(embedded).anchor;
    const transform = embedded.getTransform().copy();
    const original = target.onChange;
    let reacted = false;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector === 'replace' && !reacted) { reacted = true; this.insertText('Y', { row: 0, column: 7 }, false); }
    };
    manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 0 }, false));
    const after = target.textAndAttributes;
    const afterTransform = embedded.getTransform().copy();
    for (let cycle = 0; cycle < 5; cycle++) {
      env.undoManager.undo();
      expect(target.textAndAttributes).deep.equals(before);
      expect(target.submorphs).deep.equals(children);
      expect(target.embeddedMorphMap.get(embedded).anchor).equals(anchor);
      expect(anchor.position).deep.equals({ row: 0, column: 3 });
      expect(embedded.getTransform()).deep.equals(transform);
      env.undoManager.redo();
      expect(target.textAndAttributes).deep.equals(after);
      expect(target.submorphs).deep.equals(children);
      expect(anchor.position).deep.equals({ row: 0, column: 4 });
      expect(embedded.getTransform()).deep.equals(afterTransform);
    }
  });

  it('delivers one committed boundary for a composed replay and none for failed work', () => {
    const target = text('abcdef');
    const original = target.onChange;
    let budget = 1;
    let calls = 0;
    target.onChange = function (change) {
      original.call(this, change);
      if (change.selector !== 'replace') return;
      calls++;
      if (budget-- > 0) this.insertText('Y', { row: 0, column: 0 }, false);
    };
    const committed = [];
    manager.addCommittedChangeListener((set, context) => committed.push(context.origin), { containsMorph: m => m === target });
    manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 5 }, false));
    expect(committed).to.have.length(1);
    const count = calls;
    budget = 1;
    env.undoManager.undo();
    expect(committed).to.have.length(2);
    expect(calls > count).equals(true);
    budget = 1;
    env.undoManager.redo();
    expect(committed).to.have.length(3);
    expect(env.undoManager.undos).to.have.length(1);
    const before = target.textAndAttributes;
    const cause = new Error('failed second unit');
    budget = 1;
    expect(failureOf(() => manager.transaction({ scope: target }, () => {
      target.insertText('Z', { row: 0, column: 3 }, false);
      throw cause;
    }))).equals(cause);
    expect(target.textAndAttributes).deep.equals(before);
    expect(committed).to.have.length(3);
    expect(env.undoManager.undos).to.have.length(1);
  });

  it('keeps document-edit order when anchor positioning triggers another Text edit before notification', () => {
    const target = text('abcdef');
    const embedded = morph();
    target.insertText([embedded, null], { row: 0, column: 3 }, false);
    const before = target.textAndAttributes;
    const original = embedded.onChange;
    let reacted = false;
    embedded.onChange = function (change) {
      original.call(this, change);
      if (change.prop === 'position' && !reacted) { reacted = true; target.insertText('Y', { row: 0, column: 7 }, false); }
    };
    const result = manager.transaction({ scope: target }, () => target.insertText('X', { row: 0, column: 0 }, false));
    const edits = result.changeSet.operations.filter(operation => operation.kind === 'replace-text');
    expect(edits).to.have.length(2);
    expect(edits[0].after).deep.equals(['X', null]);
    expect(edits[1].after).deep.equals(['Y', null]);
    const after = target.textAndAttributes;
    for (let cycle = 0; cycle < 5; cycle++) {
      env.undoManager.undo();
      expect(target.textAndAttributes).deep.equals(before);
      env.undoManager.redo();
      expect(target.textAndAttributes).deep.equals(after);
    }
  });
});
