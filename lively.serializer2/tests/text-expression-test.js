/* global describe, it */
import { expect } from 'mocha-es6';
import { morph } from 'lively.morphic';
import ExpressionSerializer, { serializeSpec } from '../plugins/expression-serializer.js';

describe('text expression serialization', () => {
  it('round-trips a label containing backslashes without pre-escaping its text', () => {
    const text = 'C:\\temp\\file.txt';
    const label = morph({ type: 'label', textAndAttributes: [text, { fontWeight: 'bold' }] });
    const expression = serializeSpec(label, { asExpression: true });
    const restored = new ExpressionSerializer().deserializeExprObj(expression);

    expect(restored.textString, 'label text must survive expression serialization exactly').equals(text);
    expect(restored.textAndAttributes, 'text attributes must survive with the backslash text')
      .deep.equals(label.textAndAttributes);
  });
});
