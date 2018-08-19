/*global describe, it*/

import { expect } from "mocha-es6";

import { Color } from "../color.js";
import { LinearGradient } from "lively.graphics";

describe("lively.graphics", () => {

  it("parses a hex string", () => {
    expect(Color.rgbHex("#FFFFFF")).stringEquals(Color.white);
    expect(Color.rgbHex("#000000")).stringEquals(Color.black);
  });

  it("interpolates colors", () => {
    expect(Color.white.interpolate(.5, Color.black).equals(Color.fromTuple([.5,.5,.5,1]))).equals(true);
  });

  it("interpolates linear gradient", () => {
    let g1 = new LinearGradient({
      stops: [
        {
          color: Color.white,
          offset: 0
        },{
          color: Color.black,
          offset: 1
        }
      ]
    }),
        g2 = new LinearGradient({
          stops: [
        {
          color: Color.black,
          offset: 0.2
        },{
          color: Color.fromTuple([.2,.4,.6]),
          offset: .8
        }
      ]
    });
    expect(g1.interpolate(.5, g2).equals(new LinearGradient({
      stops: [
        {
          color: Color.fromTuple([.5, .5, .5]),
          offset: .1
        },{
          color: Color.fromTuple([.1, .2, .3]),
          offset: .9
        }
      ]
    }))).equals(true);
  });
});
