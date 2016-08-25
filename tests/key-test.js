/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";


import Keys from "../events/Keys.js";
let {
  keyComboToEventSpec: event,
  computeHashIdOfEvent: hash,
  eventToKeyCombo: stringify,
  canonicalizeKeyCombo: canonicalize
} = Keys;

describe("Keys", () => {
  
  describe("key string -> event", () => {
    
    it("char", () =>
      expect(event("a"))
        .containSubset({isModified: false, keyCode: 97, keyString: "a", shiftKey: false, hashId: -1}))

    it("upper case char", () =>
      expect(event("A"))
        .containSubset({isModified: false, keyCode: 65, keyString: "A", shiftKey: false}))

    it("shifted", () =>
      expect(event("Shift-a"))
        .containSubset({isModified: true, keyCode: 65, shiftKey: true}))

    it("esc key", () =>
      expect(event("Esc"))
        .containSubset({isModified: false, keyCode: 27, shiftKey: false}))

    it("modified esc key", () =>
      expect(event("Shift-Alt-Esc"))
        .containSubset({isModified: true, isFunctionKey: true, keyCode: 27, shiftKey: true, altKey: true}))

    it("function key", () =>
      expect(event("F1"))
        .containSubset({isModified: false, isFunctionKey: true, keyCode: 112, keyString: ""}))

    it("modified function key", () =>
      expect(event("cmd-F1"))
        .containSubset({isModified: true, isFunctionKey: true, keyCode: 112, metaKey: true}))

    it("space", () =>
      expect(event(" "))
        .containSubset({isModified: false, isFunctionKey: true, keyCode: 32, keyString: " "}))

    it("modified space", () =>
      expect(event("Alt- "))
        .containSubset({isModified: true, isFunctionKey: true, keyCode: 32, keyString: " ", altKey: true}))

    it("just modified", () =>
      expect(event("Shift"))
        .containSubset({isModified: true, isFunctionKey: false, keyCode: 0, keyString: "", shiftKey: true}))

    it("just modified 2", () =>
      expect(event("Ctrl-Shift"))
        .containSubset({isModified: true, isFunctionKey: false, keyCode: 0, keyString: "", shiftKey: true, ctrlKey: true}))

  });


  describe("modifier hash", () => {

    it("non modified (space)", () => expect(hash(event(" "))).equals(0));
    it("non modified (char)", () =>  expect(hash(event("a"))).equals(-1));
    it("enter", () =>                expect(hash(event("Enter"))).equals(0));
    it("single modifier 1", () =>    expect(hash(event("alt-a"))).equals(2));
    it("single modifier 2", () =>    expect(hash(event("shift-a"))).equals(4));
    it("single modifier 3", () =>    expect(hash(event("cmd-a"))).equals(8));
    it("single modifier 4", () =>    expect(hash(event("ctrl-a"))).equals(1));
    it("shift+cmd", () =>            expect(hash(event("shift-cmd-a"))).equals(12));
    it("ctrl+shift 1", () =>         expect(hash(event("ctrl-shift-a"))).equals(5));
    it("ctrl+shift 2", () =>         expect(hash(event("ctrl-shift-a"))).equals(5));
    it("only modifier 1", () =>      expect(hash(event("ctrl"))).equals(1));
    it("only modifier 2", () =>      expect(hash(event("ctrl-shift"))).equals(5));

  });

  describe("canonicalize keys", () => {
    it("ctrl-shift", () =>      expect(canonicalize("ctrl-shift")).equals("Ctrl-Shift"));
    it("shift-control", () =>   expect(canonicalize("shift-control")).equals("Ctrl-Shift"));
    it("shift-control-a", () => expect(canonicalize("shift-control-a")).equals("Ctrl-Shift-A"));
    it("A", () =>               expect(canonicalize("A")).equals("input-A"));
    it("a", () =>               expect(canonicalize("a")).equals("input-a"));
    it("esc", () =>             expect(canonicalize("esc")).equals("Esc"));
    it("Escape", () =>          expect(canonicalize("Escape")).equals("Esc"));
  });

  describe("evt => key string", () => {
    
    it("char", () =>                expect(stringify(event("s"))).equals("input-s"));
    it("modified + shifted", () =>  expect(stringify(event("Shift-cmd-s"))).equals("Command-Shift-S"));
    it("modified", () =>            expect(stringify(event("Command-s"))).equals("Command-S"));
    it("only modified", () =>       expect(stringify(event("alt"))).equals("Alt"));
    it("only modifier again", () => expect(stringify(event("Alt"))).equals("Alt"));

  });

  describe("input evt => key string", () => {
    
    it("s", () => expect(stringify({type: "input", data: "s"})).equals("input-s"));
    it("S", () => expect(stringify({type: "input", data: "S"})).equals("input-S"));
    it("multiple chars", () => expect(stringify({type: "input", data: "Test"})).equals("input-Test"));

  });

});



import { KeyHandler } from "../events/keyhandler.js";

describe("key bindings", () => {
  
  var handler;
  beforeEach(() => handler = new KeyHandler());

  it("binds and looks up commands", () => {
    handler.bindKey("a", "test");
    handler.bindKey("ctrl-a", {command: "test-2", prop: 23});
    expect(handler.lookup("a")).deep.equals({command: "test"});
    expect(handler.lookup("control-a")).deep.equals({command: "test-2", prop: 23});
    expect(handler.lookup("b")).equals(undefined);
  });

  it("removes commands", () => {
    handler.bindKey("a", "test");
    handler.unbindKey("a");
    expect(handler.lookup("a")).equals(undefined);
  });

  it("binds commands to platforms", () => {
    handler = new KeyHandler("windows");
    handler.bindKey({win: "ctrl-a", mac: "cmd-a"}, "test");
    expect(handler.lookup("ctrl-a")).deep.equals({command: "test"}, "win matching");
    expect(handler.lookup("cmd-a")).equals(undefined, "win not matching");
    handler = new KeyHandler("mac");
    handler.bindKey({win: "ctrl-a", mac: "cmd-a"}, "test");
    expect(handler.lookup("ctrl-a")).equals(undefined, "mac not matching");
    expect(handler.lookup("cmd-a")).deep.equals({command: "test"}, "mac matching");
    handler = new KeyHandler("mac");
    handler.bindKey({win: "ctrl-a"}, "test");
    expect(handler.lookup("ctrl-a")).equals(undefined, "single 1");
    expect(handler.lookup("cmd-a")).equals(undefined, "single 2");
  });

  it("defines multiple bindings via |", () => {
    handler.bindKey("ctrl-a|shift-a", "test");
    expect(handler.lookup("cmd-a")).equals(undefined, "1");
    expect(handler.lookup("ctrl-a")).deep.equals({command: "test"}, "2");
    expect(handler.lookup("shift-a")).deep.equals({command: "test"}, "3");
    expect(handler.lookup("shift-b")).equals(undefined, "4");
  });

  it("defines multiple bindings via array", () => {
    handler.bindKey(["ctrl-b", "shift-b"], "test");
    expect(handler.lookup("cmd-b")).equals(undefined, "5");
    expect(handler.lookup("ctrl-b")).deep.equals({command: "test"}, "6");
    expect(handler.lookup("shift-b")).deep.equals({command: "test"}, "7");
  });

  it("defines multiple bindings for platform", () => {
    handler = new KeyHandler("windows");
    handler.bindKey({win: "ctrl-a|shift-a"}, "test");
    expect(handler.lookup("ctrl-a")).deep.equals({command: "test"}, "8");
    expect(handler.lookup("shift-a")).deep.equals({command: "test"}, "9");
  });

  it("defines key chains", () => {
    handler.bindKey("ctrl-a ctrl-b", "test");
  });

  it("adds bindings to key chain", () => {
    handler.bindKey("ctrl-a ctrl-b", "test");
    expect(handler.lookup("ctrl-a")).deep.equals({command: "null", keyChain: canonicalize("ctrl-a")}, "1");
    expect(handler.lookup("ctrl-b", {keyChain: canonicalize("ctrl-a")})).deep.equals({command: "test"}, "2");
    handler.bindKey("ctrl-a ctrl-c", "test-2");
    expect(handler.lookup("ctrl-a")).deep.equals({command: "null", keyChain: canonicalize("ctrl-a")}, "3");
    expect(handler.lookup("ctrl-c", {keyChain: canonicalize("ctrl-a")})).deep.equals({command: "test-2"}, "4");
  });

  it("defines command and then key chains it over", () => {
    handler.bindKey("ctrl-a", "test-1");
    handler.bindKey("ctrl-a ctrl-b", "test-2");
    expect(handler.lookup("ctrl-a")).deep.equals({command: "null", keyChain: canonicalize("ctrl-a")}, "1");
    expect(handler.lookup("ctrl-b", {keyChain: canonicalize("ctrl-a")})).deep.equals({command: "test-2"}, "2");
  });

  it("defines command that removes key chains", () => {
    handler.bindKey("ctrl-a ctrl-b", "test-1");
    handler.bindKey("ctrl-a", "test-2");
    handler.keyBindings
    expect(handler.lookup("ctrl-a")).deep.equals({command: "test-2"}, "1");
    expect(handler.lookup("ctrl-b", {keyChain: canonicalize("ctrl-a")})).equals(undefined, "2");
  });

  it("removes key chain entirely 1", () => {
    handler.bindKey("ctrl-a ctrl-b", "test");
    handler.bindKey("ctrl-a ctrl-c", "test-2");
    handler.unbindKey("ctrl-a");
    expect(handler.keyBindings).deep.equals({});
  });

  it("removes key chain entirely 2", () => {
    handler = new KeyHandler()
    handler.bindKey("ctrl-a ctrl-b", "test");
    handler.unbindKey("ctrl-a ctrl-b");
    expect(handler.keyBindings).deep.equals({});
  });

  it("keeps key chain on removal when other chained commands exist", () => {
    handler = new KeyHandler()
    handler.bindKey("ctrl-a ctrl-b", "test");
    handler.bindKey("ctrl-a ctrl-c", "test");
    handler.unbindKey("ctrl-a ctrl-b");
    expect(handler.lookup("ctrl-b", {keyChain: canonicalize("ctrl-a")})).equals(undefined, "1");
    expect(handler.lookup("ctrl-c", {keyChain: canonicalize("ctrl-a")})).deep.equals({command: "test"}, "2");
  });


});