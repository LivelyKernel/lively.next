/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { scopes, resolveReferences, refAt } from "../lib/query.js";
import { rewriteToCaptureTopLevelVariables } from "../lib/capturing.js";
import { parse } from "../lib/parser.js";

function getRefs(pos, source) {
  const parsed = parse(source),
        scope = resolveReferences(scopes(parsed));
  return refAt(pos, scope);
}

describe.only('references', () => {

  describe("are resolved", () => {

    it("in global statements", () => {
      const refs = getRefs(11, "var x = 3; x + 1;");
      expect(refs).to.containSubset({decl: {start: 4, end: 5}});
    });
    
    it("in global statements (es2015)", () => {
      const refs = getRefs(11, "let x = 3; x + 1;");
      expect(refs).to.containSubset({decl: {start: 4, end: 5}});
      const refs2 = getRefs(13, "const x = 3; x + 1;");
      expect(refs2).to.containSubset({decl: {start: 6, end: 7}});
    });
    
    it("in global statements (hoisting)", () => {
      const refs = getRefs(0, "x + 1; var x = 1;");
      expect(refs).to.containSubset({decl: {start: 11, end: 12}});
    });

    it("in function scopes", () => {
      const refs = getRefs(28, "let x=1;function f(){return x}");
      expect(refs).to.containSubset({decl: {start: 4, end: 5}});
    });
  });
  
  describe("imports", () => {
    it("can be referenced", () => {
      const refs = getRefs(22, "import {x} from 'm'; x + 1");
      expect(refs).to.containSubset({decl: {start: 8, end: 9}});
    });
  });
  
  describe("exports", () => {
    it("are references", () => {
      const refs = getRefs(18, "var x=1; export {x};");
      expect(refs).to.containSubset({decl: {start: 4, end: 5}});
    });
  });
});
