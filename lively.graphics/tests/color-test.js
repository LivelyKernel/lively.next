/* global describe, it */

import { expect } from 'mocha-es6';

import { Color } from '../color.js';
import { LinearGradient } from 'lively.graphics';

describe('lively.graphics', () => {
  it('parses a hex string', () => {
    expect(Color.rgbHex('#FFFFFF')).stringEquals(Color.white);
    expect(Color.rgbHex('#000000')).stringEquals(Color.black);
  });

  it('interpolates colors', () => {
    expect(Color.white.interpolate(0.5, Color.black).equals(Color.fromTuple([0.5, 0.5, 0.5, 1]))).equals(true);
  });

  it('interpolates linear gradient', () => {
    let g1 = new LinearGradient({
      stops: [
        {
          color: Color.white,
          offset: 0
        }, {
          color: Color.black,
          offset: 1
        }
      ]
    });
    let g2 = new LinearGradient({
      stops: [
        {
          color: Color.black,
          offset: 0.2
        }, {
          color: Color.fromTuple([0.2, 0.4, 0.6]),
          offset: 0.8
        }
      ]
    });
    expect(g1.interpolate(0.5, g2).equals(new LinearGradient({
      stops: [
        {
          color: Color.fromTuple([0.5, 0.5, 0.5]),
          offset: 0.1
        }, {
          color: Color.fromTuple([0.1, 0.2, 0.3]),
          offset: 0.9
        }
      ]
    }))).equals(true);
  });
});
