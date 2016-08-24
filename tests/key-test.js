/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";
import Keys from "../events/Keys.js";

var event = Keys.keyComboToEventSpec;
var hash = Keys.computeHashIdOfEvent;
var stringify = Keys.eventToKeyCombo;
var canonicalize = Keys.canonicalizeKeyCombo;

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
