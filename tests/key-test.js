/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";
import Keys from "../events/Keys.js";

var event = Keys.keyStringToEventSpec;
var hash = Keys.computeHashIdOfEvent;
var stringify = Keys.eventToKeyString;

describe("Keys", () => {
  
  describe("key string -> event", () => {
    
    it("char", () =>
      expect(event("a"))
        .containSubset({isModified: false, keyCode: 65, keyString: "A", shiftKey: false}))

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
        .containSubset({isModified: false, isFunctionKey: false, keyCode: 32, keyString: " "}))

    it("modified space", () =>
      expect(event("Alt- "))
        .containSubset({isModified: true, isFunctionKey: false, keyCode: 32, keyString: " ", altKey: true}))

    it("just modified", () =>
      expect(event("Shift"))
        .containSubset({isModified: true, isFunctionKey: false, keyCode: 0, keyString: "", shiftKey: true}))

  });


  describe("modifier hash", () => {

    it("non modified (space)", () => expect(hash(event(" "))).equals(0));
    it("non modified (char)", () => expect(hash(event("a"))).equals(0));

  });

  describe("evt => key string", () => {
    
    it("char", () => expect(stringify(event("s"))).equals("S"));
    it("modified + shifted", () => expect(stringify(event("Shift-cmd-s"))).equals("Command-Shift-S"));
    it("modified", () => expect(stringify(event("Command-s"))).equals("Command-S"));
    it("only modified", () => expect(stringify(event("alt"))).equals("Alt"));
    it("only modifier again", () => expect(stringify(event("Alt"))).equals("Alt"));

  })
});
