/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Text } from "../../index.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";

function text(string, props) {
  return new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monospace",
    fontSize: 10,
    extent: pt(100,100),
    fontMetric,
    ...props
  });
}


describe("text layout", () => {

  describe("fit", () => {

    it("computes size on construction", () => {
      var t = text("hello", {fixedWidth: false, fixedHeight: false}),
          {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: false});
      expect(height).equals(fontMetric.height);
      expect(width).equals(5*fontMetric.width);
    });

    it("computes only width", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
      expect(height).equals(100);
      expect(width).equals(5*fontMetric.width);
    });

    it("computes only height", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
      expect(height).equals(fontMetric.height);
      expect(width).equals(100);
    });

    it("leaves extent as is with fixed sizing", () => {
      var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
      expect(extent).equals(pt(100,100));
    });

  });


  describe("positions", () => {

    var t, r, w, h;
    beforeEach(() => {
      t = text("hello\n lively\nworld");
      r = t.renderer;
      ({height:h, width:w} = fontMetric);
    });

    it("text pos -> pixel pos", () => {
      expect(r.pixelPositionFor(t, {row: 0, column: 0}))    .equals(pt(0,   0));
      expect(r.pixelPositionFor(t, {row: 0, column: 5}))    .equals(pt(5*w, 0));
      expect(r.pixelPositionFor(t, {row: 1, column: 0}))    .equals(pt(0,   h));
      expect(r.pixelPositionFor(t, {row: 1, column: 1}))    .equals(pt(1*w, h));
      expect(r.pixelPositionFor(t, {row: 3, column: 2}))    .equals(pt(2*w, 2*h));
      expect(r.pixelPositionFor(t, {row: 1, column: 100}))  .equals(pt(7*w, h));
      expect(r.pixelPositionFor(t, {row: 100, column: 100})).equals(pt(5*w, 2*h));
    });

    it("text index -> pixel pos", () => {
      expect(r.pixelPositionForIndex(t, 0)).equals(pt(0,0));
      expect(r.pixelPositionForIndex(t, 6)).equals(pt(0,h));
      expect(r.pixelPositionForIndex(t, 7)).equals(pt(w,h));
      expect(r.pixelPositionForIndex(t, 100)).equals(pt(5*w,2*h));
    });

    it("pixel pos -> text pos", () => {
      expect(t.textPositionFromPoint(pt(0,0)))            .deep.equals({row: 0, column: 0});
      expect(t.textPositionFromPoint(pt(w-1,h/2)))        .deep.equals({row: 0, column: 1});
      expect(t.textPositionFromPoint(pt(w+1,h+1)))        .deep.equals({row: 1, column: 1});
      expect(t.textPositionFromPoint(pt(w*2+1,h*2+1)))    .deep.equals({row: 2, column: 2});
      expect(t.textPositionFromPoint(pt(w*2+w/2+1,h*2+1))).deep.equals({row: 2, column: 3}, "right side of char -> next pos")
    });

  });

});
