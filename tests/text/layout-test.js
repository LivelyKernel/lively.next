/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { Text } from "../../text/morph.js";
import { TextAttribute } from "../../text/style.js";
import { expect } from "mocha-es6";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";


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
    fontMetric,
    // fontMetric: $$world.env.fontMetric,
    // textLayout: new TextLayout(fontMetric),
    // textRenderer: newRenderer,
    ...props
  });
  ([{height:h, width:w}] = t.textLayout.fontMetric.charBoundsFor(t.styleProps, "X"));
  return t;
}


describe("text layout", () => {

  describe("fit", () => {

    it("computes size on construction", () => {
      var t = text("hello", {fixedWidth: false, fixedHeight: false}), {width, height} = t;
      expect(height).equals(h + padding.top()+ padding.bottom());
      expect(width).equals(5*w + padding.left()+ padding.right());
    });

    it("computes only width", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: false, fixedHeight: true});
      expect(height).equals(100);
      expect(width).equals(5*w + padding.top()+ padding.bottom());
    });

    it("computes only height", () => {
      var {extent: {x: width, y: height}} = text("hello", {fixedWidth: true, fixedHeight: false});
      expect(height).equals(h + padding.top()+ padding.bottom());
      expect(width).equals(100);
    });

    it("leaves extent as is with fixed sizing", () => {
      var {extent} = text("hello", {fixedWidth: true, fixedHeight: true});
      expect(extent).equals(pt(100,100));
    });

  });


  describe("positions", () => {

    var t, r;
    beforeEach(() => {
      t = text("hello\n lively\nworld");
      r = t.textLayout;
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


describe("line wrapping", () => {

  var t;

  it("wraps single line and computes positions back and forth", () => {
    t = text("", {
      padding: Rectangle.inset(0), borderWidth: 0, fill: Color.red,
      lineWrapping: false, clipMode: "auto",
      width: 4*w, textString: "abcdef\n1234567"
    });

    var l = t.textLayout;

    t.textLayout.updateFromMorphIfNecessary(t);

    expect(l.lines).to.have.length(2);
    expect(l.wrappedLines(t)).to.have.length(2);
    expect(t.charBoundsFromTextPosition({row: 0, column: 5})).equals(rect(w*5,0,w,h), "not wrapped: text pos => pixel pos");
    expect(t.textPositionFromPoint(pt(2*w+1, h+1))).deep.equals({column: 2,row: 1}, "not wrapped: pixel pos => text pos");

    t.lineWrapping = true;
    expect(l.wrappedLines(t)).to.have.length(4);

    expect(l.boundsForScreenPos(t, {row: 0, column: 4})).equals(rect(w*4,0,0,h), "wrapped: text pos => pixel pos 1");
    expect(l.boundsForScreenPos(t, {row: 0, column: 5})).equals(rect(w*4,0,0,h), "wrapped: text pos => pixel pos 2");
    expect(l.boundsForScreenPos(t, {row: 1, column: 1})).equals(rect(w*1,h,w,h), "wrapped: pixel pos => text pos 3");
    expect(l.boundsForScreenPos(t, {row: 3, column: 1})).equals(rect(w*1,3*h,w,h), "wrapped: pixel pos => text pos 4");
    expect(l.boundsForScreenPos(t, {row: 0, column: 4})).equals(rect(w*4,0,0,h), "wrapped: pixel pos => text pos 5");

    expect(l.docToScreenPos(t, {row: 0, column: 4})).deep.equals({row: 1, column: 0}, "doc => screen pos 1");
    expect(l.docToScreenPos(t, {row: 0, column: 5})).deep.equals({row: 1, column: 1}, "doc => screen pos 2");
    expect(l.docToScreenPos(t, {row: 0, column: 6})).deep.equals({row: 1, column: 2}, "doc => screen pos 3");
    expect(l.docToScreenPos(t, {row: 1, column: 1})).deep.equals({row: 2, column: 1}, "doc => screen pos 4");
    expect(l.docToScreenPos(t, {row: 1, column: 6})).deep.equals({row: 3, column: 2}, "doc => screen pos 5");

    expect(l.screenToDocPos(t, {row: 0, column: 1})).deep.equals({row: 0, column: 1}, "screen => doc line 1 pos 1");
    // at screen line end...
    expect(l.screenToDocPos(t, {row: 0, column: 4})).deep.equals({row: 0, column: 4}, "screen => doc line 1 pos 2");
    // ...at screen line start, note, it's the same position as line end for the document!
    expect(l.screenToDocPos(t, {row: 0, column: 5})).deep.equals({row: 0, column: 4}, "screen => doc line 1 pos 3");
    expect(l.screenToDocPos(t, {row: 1, column: 0})).deep.equals({row: 0, column: 4}, "screen => doc line 1 pos 4");
    expect(l.screenToDocPos(t, {row: 1, column: 1})).deep.equals({row: 0, column: 5}, "screen => doc line 1 pos 5");
    expect(l.screenToDocPos(t, {row: 1, column: 2})).deep.equals({row: 0, column: 6}, "screen => doc line 1 pos 6");
    expect(l.screenToDocPos(t, {row: 1, column: 3})).deep.equals({row: 0, column: 6}, "screen => doc line 1 pos 7");

    expect(l.screenToDocPos(t, {row: 2, column: 0})).deep.equals({row: 1, column: 0}, "screen => doc pos line 2 1");
    expect(l.screenToDocPos(t, {row: 2, column: 3})).deep.equals({row: 1, column: 3}, "screen => doc pos line 2 2");
    expect(l.screenToDocPos(t, {row: 2, column: 4})).deep.equals({row: 1, column: 4}, "screen => doc pos line 2 3");
    expect(l.screenToDocPos(t, {row: 2, column: 5})).deep.equals({row: 1, column: 4}, "screen => doc pos line 2 4");
    expect(l.screenToDocPos(t, {row: 3, column: 0})).deep.equals({row: 1, column: 4}, "screen => doc pos line 2 5");
    expect(l.screenToDocPos(t, {row: 3, column: 1})).deep.equals({row: 1, column: 5}, "screen => doc pos line 2 6");
    expect(l.screenToDocPos(t, {row: 3, column: 3})).deep.equals({row: 1, column: 7}, "screen => doc pos line 2 7");
    expect(l.screenToDocPos(t, {row: 3, column: 4})).deep.equals({row: 1, column: 7}, "screen => doc pos line 2 8");

    expect(l.screenToDocPos(t, {row: 4, column: 0})).deep.equals({row: 1, column: 7}, "screen => doc pos after text");
  });

  it("wraps attribute line", () => {

    var textAttributes = [
      TextAttribute.create({fontColor: "blue"}, 0,0,0,3),
      TextAttribute.create({fontColor: "green"}, 0,3,0,6)]

    t = text("", {
      padding: Rectangle.inset(0), borderWidth: 0, fill: Color.red,
      lineWrapping: true, clipMode: "auto",
      width: 4*w, textString: "abcdef",
      textAttributes
    });

    var wrappedLines = t.textLayout.wrappedLines(t)
    expect(wrappedLines[0].chunks[0]).containSubset({text: "abc"});
    expect(wrappedLines[0].chunks[1]).containSubset({text: "d"});
    expect(wrappedLines[1].chunks[0]).containSubset({text: "ef"});

  });

});