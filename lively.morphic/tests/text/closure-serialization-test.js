/* global System, describe, it */
import { expect } from 'mocha-es6';
import { Text } from '../../text/morph.js';
import { Morph } from '../../morph.js';
import { Color } from 'lively.graphics';
import { ObjectPool, ExpressionSerializer } from 'lively.serializer2';
import { serializeMorph, deserializeMorph } from '../../serialization.js';

function inspectorToggle(target, keyString, node) {
  return () => { target[keyString] = !target[keyString]; node.rerender(); };
}

describe('rich-text native callback serialization', () => {
  it('keeps embedded morph references and color expressions in the custom text snapshot', async () => {
    const embedded = new Morph({name: 'embedded', fill: Color.blue});
    const text = new Text({textAndAttributes: ['before ', {fontColor: Color.red}, embedded, null, ' after', null]}).openInWorld();
    let copied;
    try {
      await text.whenRendered();
      copied = text.copy();
      const copiedEmbedded = copied.textAndAttributes.find(value => value?.isMorph);
      expect(copiedEmbedded).not.equals(embedded);
      expect(copiedEmbedded.name).equals('embedded');
      expect(copiedEmbedded.fill).equals(Color.blue);
      expect(copiedEmbedded.owner).equals(copied);
      expect(copied.textAndAttributes[1].fontColor).equals(Color.red);
    } finally {
      copied?.remove();
      text.remove();
    }
  });

  it('copies and saves inspector toggle attributes without serializing their captured environment', async () => {
    const target = {enabled: false};
    const keyString = 'enabled';
    const node = {rerenders: 0, rerender() { this.rerenders++; }};
    const onMouseDown = inspectorToggle(target, keyString, node);
    const attributes = {fontColor: Color.red, doit: {onMouseDown}};
    const text = new Text({readOnly: true, textAndAttributes: ['toggle', attributes]}).openInWorld();
    let copied, restored;
    try {
      await text.whenRendered();
      const pool = ObjectPool.withDefaultPlugins();
      const serializeClosure = System.global.__serializeDebugClosure;
      try {
        delete System.global.__serializeDebugClosure;
        const snapshot = serializeMorph(text, {objPool: pool});
        restored = deserializeMorph(JSON.parse(JSON.stringify(snapshot)));
        copied = text.copy();
      } finally { System.global.__serializeDebugClosure = serializeClosure; }
      for (const result of [restored, copied]) {
        expect(result.textString).equals('toggle');
        expect(result.textAndAttributes[1].fontColor).equals(Color.red);
        expect(result.textAndAttributes[1].doit.onMouseDown).equals(undefined);
      }
      expect(pool.ref(onMouseDown)).equals(undefined);
      expect(pool.ref(target)).equals(undefined);
      expect(new ExpressionSerializer().embedValue(onMouseDown)).equals(onMouseDown);
      expect(text.textAndAttributes[1].doit.onMouseDown).equals(onMouseDown);
      onMouseDown();
      expect(target.enabled).equals(true);
      expect(node.rerenders).equals(1);
    } finally {
      copied?.remove();
      restored?.remove();
      text.remove();
    }
  });
});
