/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/

import { expect } from "mocha-es6";
import TextLayout from "../../text2/text-layout.js";


import { pt, rect, Color, Rectangle } from "lively.graphics";
import { Text } from "../../text2/morph.js";

// import { Range } from "../../text/range.js";
// import { TextAttribute } from "../../text/attribute.js";
// import { dummyFontMetric as fontMetric } from "../test-helpers.js";


var padding = Rectangle.inset(5);

var w, h;
function text(string, props) {
  var t = new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monospace",
    fontSize: 10,
    extent: pt(100,100),
    padding,
    clipMode: "auto",
    // fontMetric,
    // fontMetric: $$world.env.fontMetric,
    // textLayout: new TextLayout(fontMetric),
    // textRenderer: newRenderer,
    ...props
  });

  [{height:h, width:w}] = t.env.fontMetric.charBoundsFor(t.defaultTextStyle, "X");
  return t;
}


describe("text layout", () => {


  describe("positions", () => {

    var t, tl, padl, padr, padt, padb;
    beforeEach(() => {
      t = text("hello\n lively\nworld");
      tl = t.textLayout;

      padl = padding.left();
      padr = padding.right();
      padt = padding.top();
      padb = padding.bottom();
    });

    it("text pos -> pixel pos", () => {
      expect(tl.pixelPositionFor(t, {row: 0, column: 0}))    .equals(pt(padl+0,   padt+0));
      expect(tl.pixelPositionFor(t, {row: 0, column: 4}))    .equals(pt(padl+4*w, padt+0));
      expect(tl.pixelPositionFor(t, {row: 0, column: 5}))    .equals(pt(padl+5*w, padt+0));
      expect(tl.pixelPositionFor(t, {row: 1, column: 0}))    .equals(pt(padl+0,   padt+h));
      expect(tl.pixelPositionFor(t, {row: 1, column: 1}))    .equals(pt(padl+1*w, padt+h));
      expect(tl.pixelPositionFor(t, {row: 3, column: 2}))    .equals(pt(padl+2*w, padt+2*h));
      expect(tl.pixelPositionFor(t, {row: 1, column: 100}))  .equals(pt(padl+7*w, padt+h));
      expect(tl.pixelPositionFor(t, {row: 100, column: 100})).equals(pt(padl+5*w, padt+2*h));
    });

    it("pixel pos -> text pos", () => {
      expect(t.textPositionFromPoint(pt(padl+0,         padt+0)))    .deep.equals({row: 0, column: 0}, "1");
      expect(t.textPositionFromPoint(pt(padl+w-1,       padt+h/2)))  .deep.equals({row: 0, column: 1}, "2");
      expect(t.textPositionFromPoint(pt(padl+w+1,       padt+h+1)))  .deep.equals({row: 1, column: 1}, "3");
      expect(t.textPositionFromPoint(pt(padl+w*2+1,     padt+h*2+1))).deep.equals({row: 2, column: 2}, "4");
      expect(t.textPositionFromPoint(pt(padl+w*2+w/2+1, padt+h*2+1))).deep.equals({row: 2, column: 3}, "right side of char -> next pos")
    });

  });


//   describe("fit", () => {
// 
//     it("computes size on construction", () => {
//       var t = text("hello", {fixedWidth: false, fixedHeight: false}), {width, height} = t;
//       expect(height).equals(h + padding.top()+ padding.bottom());
//       expect(width).equals(5*w + padding.left()+ padding.right());
//     });
// 
//     it("computes only width", () => {
//       var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
//       expect(height).equals(100);
//       expect(width).equals(5*w + padding.top()+ padding.bottom());
//     });
// 
//     it("computes only height", () => {
//       var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
//       expect(height).equals(h + padding.top()+ padding.bottom());
//       expect(width).equals(100);
//     });
// 
//     it("leaves extent as is with fixed sizing", () => {
//       var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
//       expect(extent).equals(pt(100,100));
//     });
// 
//   });

  describe("line wrapping", () => {

    let padb,padt,padr, padl, t, l;

    beforeEach(() => {
      padl = padding.left();
      padr = padding.right();
      padt = padding.top();
      padb = padding.bottom();

      t = text("abcdef\n1234567", {
        padding, borderWidth: 0, fill: Color.limeGreen,
        lineWrapping: false, clipMode: "visible",
        fixedWidth: true,
        fontSize: 10,
        width: 4*w+padl+padr
      });

      l = t.textLayout;

      // with t.lineWrapping = "by-chars";
      // text is wrapped like "abcd\nef"
    });

    it("wraps single line and computes positions back and forth", () => {
      expect(t.lineCount()).equals(2);
      expect(t.charBoundsFromTextPosition({row: 0, column: 5})).equals(rect(padl+w*5,padt,w,h-1), "not wrapped: text pos => pixel pos");
      expect(t.textPositionFromPoint(pt(padl + 2*w+1, padt + h+1))).deep.equals({column: 2,row: 1}, "not wrapped: pixel pos => text pos");

      t.lineWrapping = "by-chars";
      expect(l.boundsFor(t, {row: 0, column: 3})).equals(rect(padl+w*3,padt+h*0,6,h-1), "wrapped: text pos => pixel pos 1");
      expect(l.boundsFor(t, {row: 0, column: 4})).equals(rect(padl+w*0,padt+h*1,6,h-1), "wrapped: text pos => pixel pos 1");
      expect(l.boundsFor(t, {row: 0, column: 5})).equals(rect(padl+w*1,padt+h*1,6,h-1), "wrapped: text pos => pixel pos 1");
      expect(l.boundsFor(t, {row: 0, column: 6})).equals(rect(padl+w*2,padt+h*1,0,h-1), "wrapped: text pos => pixel pos 1");
    });

    it("screenLineRange", () => {
      t.lineWrapping = "by-chars";
      let range = t.screenLineRange({row: 0, column: 5});
      expect(range).deep.equals({start: {row: 0, column: 4}, end: {row: 0, column: 6}});
    });

  });

});
