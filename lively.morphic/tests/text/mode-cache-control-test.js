/* global describe, it */
import { expect } from 'mocha-es6';
import { Text, Morph } from '../../index.js';
import { Color, pt } from 'lively.graphics';

describe('text mode cache control', () => {
  it('disables document and static DOM retention from construction', async () => {
    const text = new Text({ cacheModeSwitches: false, readOnly: false, textString: 'first\nsecond' }).openInWorld();
    try {
      await text.whenRendered();
      for (let cycle = 0; cycle < 3; cycle++) {
        const document = text.document;
        text.readOnly = true;
        text.env.forceUpdate();
        expect(text._documentBackup).equals(undefined);
        expect(text.renderingState.cachedStaticLines).equals(undefined);
        expect(text.renderingState.visibleLines).deep.equals([]);
        text.readOnly = false;
        text.env.forceUpdate();
        expect(text.document).not.equals(document);
        expect(text.textString).equals('first\nsecond');
        text.document.consistencyCheck();
      }
      const copy = text.copy();
      try { expect(copy.cacheModeSwitches).equals(false); } finally { copy.remove(); }
    } finally { text.remove(); }
  });

  it('releases existing caches immediately when disabled in static mode', async () => {
    const text = new Text({ readOnly: false, textString: 'first\nsecond' }).openInWorld();
    try {
      await text.whenRendered();
      const document = text.document;
      const anchor = text.addAnchor({ id: 'opt-out-anchor', row: 1, column: 2 });
      text.readOnly = true;
      text.env.forceUpdate();
      const line = text.renderingState.textLayer.querySelector('.line');
      expect(text._documentBackup).equals(document);
      expect(text.renderingState.cachedStaticLines).to.be.ok;
      text.cacheModeSwitches = false;
      expect(text._documentBackup).equals(undefined);
      expect(text.renderingState.cachedStaticLines).equals(undefined);
      expect(text.renderingState.visibleLines).deep.equals([]);
      expect(text.renderingState.textLayer.querySelector('.line')).equals(line);
      expect(text.document).equals(null);
      expect(anchor.position).deep.equals({ row: 1, column: 2 });
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.document).not.equals(document);
      expect(anchor.position).deep.equals({ row: 1, column: 2 });
      text.readOnly = true;
      text.env.forceUpdate();
      expect(text._documentBackup).equals(undefined);
      expect(text.renderingState.cachedStaticLines).equals(undefined);
      text.textString = 'replacement';
      expect(anchor.position).deep.equals({ row: 0, column: 0 });
    } finally { text.remove(); }
  });

  for (const disable of [false, true]) {
    it(`${disable ? 'disabling' : 'clearing'} in editable mode preserves the active document and selection`, async () => {
      const text = new Text({ readOnly: false, textString: 'first\nsecond' }).openInWorld();
      try {
        await text.whenRendered();
        text.readOnly = true;
        text.env.forceUpdate();
        const oldLine = text.renderingState.cachedStaticLines[0];
        text.readOnly = false;
        text.env.forceUpdate();
        const document = text.document, layout = text.textLayout;
        const visibleLines = text.renderingState.visibleLines;
        text.selection.range = { start: { row: 0, column: 1 }, end: { row: 1, column: 2 } };
        const range = text.selection.range;
        if (disable) text.cacheModeSwitches = false;
        else text.clearModeSwitchCache();
        expect(text.document).equals(document);
        expect(text.textLayout).equals(layout);
        expect(text.renderingState.visibleLines).equals(visibleLines);
        expect(text.selection.range).deep.equals(range);
        expect(text.renderingState.cachedStaticLines).equals(undefined);
        expect(text.textString).equals('first\nsecond');
        text.document.consistencyCheck();
        text.readOnly = true;
        text.env.forceUpdate();
        expect(text.renderingState.textLayer.querySelector('.line')).not.equals(oldLine);
        expect(text._documentBackup).equals(disable ? undefined : document);
        if (disable) expect(text.renderingState.cachedStaticLines).equals(undefined);
        else expect(text.renderingState.cachedStaticLines).to.be.ok;
      } finally { text.remove(); }
    });
  }

  it('clears static caches idempotently, preserves attributes and anchors, then caches again', async () => {
    const text = new Text({ readOnly: false, textAndAttributes: ['first\nsecond', { fontColor: Color.blue }] }).openInWorld();
    try {
      await text.whenRendered();
      const document = text.document;
      const anchor = text.addAnchor({ id: 'clear-anchor', row: 1, column: 2 });
      text.readOnly = true;
      text.env.forceUpdate();
      const line = text.renderingState.textLayer.querySelector('.line');
      text.clearModeSwitchCache();
      text.clearModeSwitchCache();
      expect(text.cacheModeSwitches).equals(true);
      expect(text._documentBackup).equals(undefined);
      expect(text.renderingState.cachedStaticLines).equals(undefined);
      expect(text.renderingState.visibleLines).deep.equals([]);
      expect(text.renderingState.textLayer.querySelector('.line')).equals(line);
      expect(text.textString).equals('first\nsecond');
      expect(anchor.position).deep.equals({ row: 1, column: 2 });
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.document).not.equals(document);
      expect(text.textAndAttributes[1].fontColor).equals(Color.blue);
      expect(anchor.position).deep.equals({ row: 1, column: 2 });
      const replacement = text.document;
      text.readOnly = true;
      text.env.forceUpdate();
      expect(text._documentBackup).equals(replacement);
      expect(text.renderingState.cachedStaticLines).to.be.ok;
    } finally { text.remove(); }
  });

  it('still invalidates anchors on static replacement after the document cache was cleared', async () => {
    const text = new Text({ readOnly: false, textString: 'first\nsecond' }).openInWorld();
    try {
      await text.whenRendered();
      const anchor = text.addAnchor({ id: 'replacement-anchor', row: 1, column: 2 });
      text.readOnly = true;
      text.clearModeSwitchCache();
      text.clearModeSwitchCache();
      text.textString = 'replacement';
      expect(anchor.position).deep.equals({ row: 0, column: 0 });
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.textString).equals('replacement');
      text.document.consistencyCheck();
    } finally { text.remove(); }
  });

  it('allows reuse to be enabled again after opting out', async () => {
    const text = new Text({ cacheModeSwitches: false, readOnly: false, textString: 'content' }).openInWorld();
    try {
      await text.whenRendered();
      text.readOnly = true;
      text.cacheModeSwitches = true;
      text.readOnly = false;
      text.env.forceUpdate();
      const document = text.document;
      text.readOnly = true;
      text.env.forceUpdate();
      const line = text.renderingState.cachedStaticLines[0];
      text.readOnly = false;
      text.env.forceUpdate();
      expect(text.document).equals(document);
      text.readOnly = true;
      text.env.forceUpdate();
      expect(text.renderingState.cachedStaticLines[0]).equals(line);
    } finally { text.remove(); }
  });

  it('keeps a required active document when clearing a read-only Text', async () => {
    const text = new Text({ cacheModeSwitches: false, readOnly: true, needsDocument: true, textString: 'content' }).openInWorld();
    try {
      await text.whenRendered();
      const document = text.document;
      expect(document).to.be.ok;
      text.clearModeSwitchCache();
      expect(text.document).equals(document);
      expect(text.readOnly).equals(true);
      expect(text.textString).equals('content');
      document.consistencyCheck();
    } finally { text.remove(); }
  });

  it('preserves embedded morph ownership and anchors with caching disabled', async () => {
    const embedded = new Morph({ extent: pt(30, 20) });
    const text = new Text({ cacheModeSwitches: false, readOnly: false, textAndAttributes: ['before ', null, embedded, null, ' after', null] }).openInWorld();
    try {
      await text.whenRendered();
      for (let cycle = 0; cycle < 3; cycle++) {
        text.readOnly = true;
        text.env.forceUpdate();
        expect(text._documentBackup).equals(undefined);
        expect(text.renderingState.cachedStaticLines).equals(undefined);
        expect(embedded.owner).equals(text);
        text.readOnly = false;
        text.env.forceUpdate();
        expect(embedded.owner).equals(text);
        expect(text.embeddedMorphMap.get(embedded).anchor).to.be.ok;
        expect(text.textString).equals('before \ufffd after');
        text.document.consistencyCheck();
      }
    } finally { text.remove(); }
  });
});
