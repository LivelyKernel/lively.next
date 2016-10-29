/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { promise } from "lively.lang";
import { World, MorphicEnv } from "../../index.js";
import { Text } from "../../text/morph.js";
import { pt, Rectangle } from "lively.graphics";
import { CompletionController, WordCompleter } from "../../text/completion.js";
import { DynamicJavaScriptCompleter } from "../../ide/js/completers.js";
import { expect } from "mocha-es6";
import { dummyFontMetric as fontMetric } from "../test-helpers.js";
import { createDOMEnvironment } from "../../rendering/dom-helper.js";

var inBrowser = System.get("@system-env").browser ? it :
  (title) => { console.warn(`Test ${title} is currently only supported in a browser`); return xit(title); }

var text;

describe("completion controller", () => {

  beforeEach(() => text = new Text({textString: "abc\nafg\n", fontMetric}));
  
  it("computes word completions", async () => {
    text.cursorPosition = {row: 2, column: 0}
    var controller = new CompletionController(text, [new WordCompleter()]),
        {items} = await controller.completionListSpec();
    expect(items).containSubset([{value: {completion: "afg"}}, {value: {completion: "abc"}}]);
  });

  it("computes dynamic JS completions", async () => {
    if (!System.get(System.decanonicalize("lively.vm/index.js"))) return;
    text.textString = "this.";
    text.gotoDocumentEnd();
    var controller = new CompletionController(text, [new DynamicJavaScriptCompleter()]),
        {items} = await controller.completionListSpec();
    expect(items).containSubset([{value: {completion: "textString"}}]);
  });
  
})


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-



var world;
function createDummyWorld() {
  world = new World({name: "world", extent: pt(500,300), submorphs: [
    text = new Text({textString: "abc\nafg\n", fontMetric, extent: pt(400,300)})]})
  return world;
}

var env;
async function createMorphicEnv() {
  env = new MorphicEnv(await createDOMEnvironment());
  env.domEnv.document.body.style = "margin: 0";
  MorphicEnv.pushDefault(env);
  await env.setWorld(createDummyWorld());
}
async function destroyMorphicEnv() {
  MorphicEnv.popDefault().uninstall();
}


describe("completion widget", () => {

  beforeEach(() => createMorphicEnv());
  afterEach(() => destroyMorphicEnv());

  it("opens it", async () => {
    await text.simulateKeys("Alt-Space");
    await promise.delay(0);
    var menu = world.get("text completion menu");
    expect(menu.get("list").items.map(({value: {completion}}) => completion).slice(0, 2)).deep.equals(["abc", "afg"])
  });

  inBrowser("is correct aligned", async () => {
    text.cursorDown(2)
    text.insertText("a");
    await text.simulateKeys("Alt-Space");
    await promise.delay(0);
    var menu = world.get("text completion menu");
    expect(menu.get("input").textString).equals("a", "input line content doesn't show prefix");
    var pos = text.charBoundsFromTextPosition(text.cursorPosition).topLeft();
    expect(menu.position.x).closeTo(pos.x, 1, "menu position")
    expect(menu.position.y).closeTo(pos.y, 1, "menu position")
  });
})
