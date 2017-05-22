/*global System, declare, it, xit, describe, xdescribe, beforeEach, afterEach, before, after*/
import { promise } from "lively.lang";
import { World } from "../../index.js";
import { Text } from "../../text/morph.js";
import { pt } from "lively.graphics";
import { CompletionController, WordCompleter } from "../../text/completion.js";
import { DynamicJavaScriptCompleter } from "../../ide/js/completers.js";
import { expect } from "mocha-es6";

var describeInBrowser = System.get("@system-env").browser ? describe :
  (title) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xit(title); }

var text;

describeInBrowser("completion controller", () => {

  beforeEach(() =>
    text = new Text({textString: "abc\nafg\n"}));

  it("computes word completions", async () => {
    text.cursorPosition = {row: 2, column: 0}
    var controller = new CompletionController(text, [new WordCompleter()]),
        {items} = await controller.completionListSpec();
    expect(items).containSubset([{value: {completion: "afg"}}, {value: {completion: "abc"}}]);
  });

  ("computes dynamic JS completions", async () => {
    if (!System.get(System.decanonicalize("lively.vm/index.js"))) return;
    if (!System.get(System.decanonicalize("lively-system-interface"))) return;
    let {default: JavaScriptEditorPlugin} = await System.import("lively.morphic/ide/js/editor-plugin.js")
    text.plugins = [new JavaScriptEditorPlugin()];
    text.textString = "this.";
    text.gotoDocumentEnd();
    var controller = new CompletionController(text, [new DynamicJavaScriptCompleter()]),
        {items} = await controller.completionListSpec();
    expect(items).containSubset([{value: {completion: "textString"}}]);
  });
  
})


describeInBrowser("completion widget", () => {

  beforeEach(() =>
    text = new Text({textString: "abc\nafg\n", extent: pt(400,300)}).openInWorld());
  afterEach(async () => {
    await promise.delay(30);
    let complMenu = text.world().get("text completion menu")
    complMenu && complMenu.remove();
    text.remove();
  });

  it("opens it", async () => {
    await text.simulateKeys("Alt-Space");
    await promise.delay(0);
    var menu = text.world().get("text completion menu");
    expect(menu.get("list").items.map(({value: {completion}}) => completion).slice(0, 2)).deep.equals(["abc", "afg"])
  });

  it("is correct aligned", async () => {
    text.cursorDown(2);
    text.insertText("a");
    await text.simulateKeys("Alt-Space");
    await promise.delay(0);
    var menu = text.world().get("text completion menu");
    expect(menu.get("input").textString).equals("a", "input line content doesn't show prefix");
    var pos = text.charBoundsFromTextPosition(text.cursorPosition).topLeft();
    pos = text.worldPoint(pos);
    expect(menu.position.x).closeTo(pos.x, 50, "menu position x")
    expect(menu.position.y).closeTo(pos.y, 50, "menu position y")
  });
})
