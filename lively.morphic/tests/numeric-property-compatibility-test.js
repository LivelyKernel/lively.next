/* global describe, it */
import { expect } from 'mocha-es6';
import { morph } from '../index.js';
import { serializeMorph, deserializeMorph } from '../serialization.js';

describe('existing numeric property metadata', () => {
  it('preserves negative scale through assignment, copying and serialization', () => {
    const m = morph({ scale: -1 });
    expect(m.scale).equals(-1);
    m.scale = -2;
    expect(m.scale).equals(-2);
    expect(m.copy().scale).equals(-2);
    expect(deserializeMorph(serializeMorph(m)).scale).equals(-2);
  });

  it('preserves CSS line heights below one through copying and serialization', () => {
    const text = morph({ type: 'text', lineHeight: 0.8, textString: 'two\nlines' });
    expect(text.lineHeight).equals(0.8);
    text.lineHeight = 0.9;
    expect(text.lineHeight).equals(0.9);
    expect(text.copy().lineHeight).equals(0.9);
    expect(deserializeMorph(serializeMorph(text)).lineHeight).equals(0.9);
  });
});
