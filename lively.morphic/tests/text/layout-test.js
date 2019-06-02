/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { expect, chai } from "mocha-es6";
import { pt, rect, Color, Rectangle } from "lively.graphics";
import { Text } from "../../text/morph.js";
import { World, MorphicEnv } from "../../index.js";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";

var describeInBrowser = System.get("@system-env").browser ? describe :
  (title) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xit(title); }

var padding = Rectangle.inset(5);

var w, h, t, tl, padl, padr, padt, padb;

function text(string, props) {
  env = env || MorphicEnv.default();
  t = new Text({
    name: "text",
    textString: string,
    fontFamily: "Monaco, monospace",
    fontSize: 10,
    extent: pt(100,100),
    fixedWidth: true, fixedHeight: true,
    padding,
    clipMode: "auto",
    padding, borderWidth: 0, fill: Color.limeGreen,
    lineWrapping: false,
    env,
    ...props
  });

  [{height:h, width:w}] = t.env.fontMetric.charBoundsFor(t.defaultTextStyle, "X");

  tl = t.textLayout;

  padl = padding.left();
  padr = padding.right();
  padt = padding.top();
  padb = padding.bottom();

  return t;
}

var env;
async function createMorphicEnv() {
  if (System.get("@system-env").browser) return;
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = "margin: 0";
  MorphicEnv.pushDefault(env);
  await env.setWorld(new World({name: "world", extent: pt(300,300)}));
}

async function destroyMorphicEnv() {
  if (System.get("@system-env").browser) return;
  MorphicEnv.popDefault().uninstall();
}

describeInBrowser("text layout", function() {

  this.timeout(7*1000);

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  describe("positions", () => {

    it("text pos -> pixel pos", () => {
      text("hello\n lively\nworld")
      let pos;

      pos = tl.pixelPositionFor(t, {row: 0, column: 0});
      expect(pos.x).closeTo(padl+0, 2);
      expect(pos.y).closeTo(padt+0, 2);

      pos = tl.pixelPositionFor(t, {row: 0, column: 4});
      expect(pos.x).closeTo(padl+4*w, 2);
      expect(pos.y).closeTo(padt+0, 2);

      pos = tl.pixelPositionFor(t, {row: 0, column: 5});
      expect(pos.x).closeTo(padl+5*w, 2);
      expect(pos.y).closeTo(padt+0, 2);

      pos = tl.pixelPositionFor(t, {row: 1, column: 0});
      expect(pos.x).closeTo(padl+0, 2);
      expect(pos.y).closeTo(padt+h, 2);

      pos = tl.pixelPositionFor(t, {row: 1, column: 1});
      expect(pos.x).closeTo(padl+1*w, 2);
      expect(pos.y).closeTo(padt+h, 2);

      pos = tl.pixelPositionFor(t, {row: 3, column: 2});
      expect(pos.x).closeTo(padl+2*w, 2);
      expect(pos.y).closeTo(padt+2*h, 2);

      pos = tl.pixelPositionFor(t, {row: 1, column: 100});
      expect(pos.x).closeTo(padl+7*w, 2);
      expect(pos.y).closeTo(padt+h, 2);

      pos = tl.pixelPositionFor(t, {row: 100, column: 100});
      expect(pos.x).closeTo(padl+5*w, 2);
      expect(pos.y).closeTo(padt+2*h, 2);
    });
  
    it("pixel pos -> text pos", () => {
      text("hello\n lively\nworld")
      expect(t.textPositionFromPoint(pt(padl+0,         padt+0)))    .deep.equals({row: 0, column: 0}, "1");
      expect(t.textPositionFromPoint(pt(padl+w-1,       padt+h/2)))  .deep.equals({row: 0, column: 1}, "2");
      expect(t.textPositionFromPoint(pt(padl+w+1,       padt+h+1)))  .deep.equals({row: 1, column: 1}, "3");
      expect(t.textPositionFromPoint(pt(padl+w*2+1,     padt+h*2+1))).deep.equals({row: 2, column: 2}, "4");
      expect(t.textPositionFromPoint(pt(padl+w*2+w/2+1, padt+h*2+1))).deep.equals({row: 2, column: 3}, "right side of char -> next pos")
    });
  
  });


  describe("fit", () => {

    it("computes size on construction", () => {
      var t = text("hello", {clipMode: "visible", fixedHeight: false, fixedWidth: false}),
          {width, height} = t;
      expect(height).closeTo(h + padding.top()+ padding.bottom(), 2);
      expect(width).closeTo(5*w + padding.left()+ padding.right(), 2);
    });

    it("computes only width", () => {
      var {extent: {x: width, y: height}} = text("hello", {clipMode: "visible", fixedWidth: false, fixedHeight: true});
      expect(height).closeTo(100, 2);
      expect(width).closeTo(5*w + padding.top()+ padding.bottom(), 2);
    });

    it("computes only height", () => {
      var {extent: {x: width, y: height}} = text("hello", {clipMode: "visible", fixedWidth: true, fixedHeight: false});
      expect(height).closeTo(h + padding.top()+ padding.bottom(), 2);
      expect(width).closeTo(100, 2);
    });

    it("leaves extent as is with fixed sizing", () => {
      var {extent} = text("hello", {clipMode: "visible", fixedWidth: true, fixedHeight: true});
      expect(extent.x).closeTo(100, 2);
      expect(extent.y).closeTo(100, 2);
    });

    it("when clip it won't shrink", () => {
      var {extent} = text("hello", {clipMode: "hidden"});
      expect(extent).equals(pt(100,100));
    });

    it("still shrinks when forced", () => {
      var t = text("hello", {clipMode: "hidden", fixedWidth: false, fixedHeight: false}),
          {extent: {x: width, y: height}} = t;
      t.fit();
      expect(height).closeTo(h + padding.top()+ padding.bottom(), 2);
      expect(width).closeTo(5*w + padding.left()+ padding.right(), 2);
    });

  });

    
  describe("line wrapping", () => {

    it("wraps single line and computes positions back and forth", () => {
      // await createMorphicEnv()
      // destroyMorphicEnv()
      // MorphicEnv.popDefault()
      // MorphicEnv.envs

      text("abcdef\n1234567", {width: 4*w+padl+padr});
      // t.openInWorld()

      expect(t.lineCount()).equals(2);
      expect(t.charBoundsFromTextPosition({row: 0, column: 5})).equals(rect(padl+w*5,padt,w,h-1), "not wrapped: text pos => pixel pos");
      expect(t.textPositionFromPoint(pt(padl + 2*w+1, padt + h+1))).deep.equals({column: 2,row: 1}, "not wrapped: pixel pos => text pos");

      t.lineWrapping = false;
      t.lineWrapping = "by-chars";

      let height,width,x,y;

      ({height,width,x,y} = tl.boundsFor(t, {row: 0, column: 3}));;
      expect(x).closeTo(padl+w*3, 2);
      expect(y).closeTo(padt+h*0, 2);
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h-1, 2);

      ({height,width,x,y} = tl.boundsFor(t, {row: 0, column: 4}));
      expect(x).closeTo(padl+w*0, 2);
      expect(y).closeTo(padt+h*1, 2);
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h-1, 2);

      ({height,width,x,y} = tl.boundsFor(t, {row: 0, column: 5}));
      expect(x).closeTo(padl+w*1, 2);
      expect(y).closeTo(padt+h*1, 2);
      expect(width).closeTo(6, 2);
      expect(height).closeTo(h-1, 2);

      ({height,width,x,y} = tl.boundsFor(t, {row: 0, column: 6}));
      expect(x).closeTo(padl+w*2, 2);
      expect(y).closeTo(padt+h*1, 2);
      expect(width).closeTo(0, 2);
      expect(height).closeTo(h-1, 2);
    });

    it("screenLineRange", () => {
      text("abcdef\n1234567", {width: 4*w+padl+padr});
      // t.fit()
      t.lineWrapping = "by-chars";
      let range = t.screenLineRange({row: 0, column: 5});
      expect(range).deep.equals({start: {row: 0, column: 4}, end: {row: 0, column: 6}});
    });

  });

});
