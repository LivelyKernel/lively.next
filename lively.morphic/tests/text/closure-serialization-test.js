/* global describe, it */
import { expect } from 'mocha-es6';
import { Text } from '../../text/morph.js';
import { Morph } from '../../morph.js';
import { Color } from 'lively.graphics';
import { ObjectPool, ExpressionSerializer } from 'lively.serializer2';
import { module } from 'lively.modules';
import { serializeMorph, deserializeMorph } from '../../serialization.js';

describe('rich-text native callback serialization', () => {
  /** Opens a text with `textAndAttributes`, runs `check` once it renders, and removes every morph it returns. */
  async function withText (textAndAttributes, options, check) {
    const text = new Text({textAndAttributes, ...options}).openInWorld(), created = [];
    try { await text.whenRendered(); created.push(...await check(text)); } finally {
      for (const morph of [...created, text]) morph?.remove();
    }
  }

  it('keeps embedded morph references and color expressions in the custom text snapshot', async () => {
    const embedded = new Morph({name: 'embedded', fill: Color.blue});
    await withText(['before ', {fontColor: Color.red}, embedded, null, ' after', null], {}, text => {
      const copied = text.copy(), copiedEmbedded = copied.textAndAttributes.find(value => value?.isMorph);
      expect(copiedEmbedded).not.equals(embedded);
      expect([copiedEmbedded.name, copiedEmbedded.fill, copiedEmbedded.owner, copied.textAndAttributes[1].fontColor])
        .ordered.members(['embedded', Color.blue, copied, Color.red]);
      return [copied];
    });
  });

  it('copies and saves inspector toggle attributes without serializing their captured environment', async () => {
    const fixture = module('lively.morphic/tests/text/fixtures/retained-callback.js');
    fixture.retainRuntimeClosures = true;
    const {inspectorToggle} = await fixture.load(), target = {enabled: false}, node = {rerenders: 0, rerender () { this.rerenders++; }};
    const onMouseDown = inspectorToggle(target, 'enabled', node), hook = Symbol.for('lively-serialize-closure');
    const cells = onMouseDown[Symbol.for('lively-debug-bindings')][Symbol.for('lively-debug-binding-cells')];
    expect([typeof onMouseDown[hook], cells.target.value, cells.keyString.value, cells.node.value])
      .ordered.members(['function', target, 'enabled', node]);
    Object.defineProperty(onMouseDown, hook, {configurable: true, value () {
      throw new Error('Rich-text serialization must discard this callback before traversing its environment');
    }});
    await withText(['toggle', {fontColor: Color.red, doit: {onMouseDown}}], {readOnly: true}, text => {
      const pool = ObjectPool.withDefaultPlugins();
      const results = [deserializeMorph(JSON.parse(JSON.stringify(serializeMorph(text, {objPool: pool})))), text.copy()];
      for (const result of results) {
        expect([result.textString, result.textAndAttributes[1].fontColor, result.textAndAttributes[1].doit.onMouseDown])
          .ordered.members(['toggle', Color.red, undefined]);
      }
      expect([pool.ref(onMouseDown), pool.ref(target)]).deep.equals([undefined, undefined]);
      expect([new ExpressionSerializer().embedValue(onMouseDown), text.textAndAttributes[1].doit.onMouseDown])
        .deep.equals([onMouseDown, onMouseDown]);
      onMouseDown();
      expect([target.enabled, node.rerenders]).deep.equals([true, 1]);
      return results;
    });
  });
});
