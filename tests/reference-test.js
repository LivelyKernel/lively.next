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

describe('references', () => {

  describe("are resolved", () => {

    it("in global statements", () => {
      const refs = getRefs(11, "var x = 3; x + 1;");
      expect(refs).to.containSubset({
        decl: {start: 4, end: 9, type: "VariableDeclarator"},
        declId: {start: 4, end: 5, name: "x"}
      });
    });
    
    it("in global statements (es2015)", () => {
      const refs = getRefs(11, "let x = 3; x + 1;");
      expect(refs).to.containSubset({
        decl: {start: 4, end: 9, type: "VariableDeclarator"},
        declId: {start: 4, end: 5, name: "x"}
      });
      const refs2 = getRefs(13, "const x = 3; x + 1;");
      expect(refs2).to.containSubset({
        decl: {start: 6, end: 11, type: "VariableDeclarator"},
        declId: {start: 6, end: 7, name: "x"}
      });
    });
    
    it("in global statements (hoisting)", () => {
      const refs = getRefs(0, "x + 1; var x = 1;");
      expect(refs).to.containSubset({
        decl: {start: 11, end: 16, type: "VariableDeclarator"},
        declId: {start: 11, end: 12, name: "x"}
      });
    });

    it("in function scopes", () => {
      const refs = getRefs(28, "let x=1;function f(){return x}");
      expect(refs).to.containSubset({
        decl: {start: 4, end: 7, type: "VariableDeclarator"},
        declId: {start: 4, end: 5, name: "x"}
      });
    });
  });
  
  describe("imports", () => {
    it("can be referenced", () => {
      const refs = getRefs(22, "import {x} from 'm'; x + 1");
      expect(refs).to.containSubset({
        decl: {start: 8, end: 9},
        declId: {start: 8, end: 9}
      });
    });
  });
  
  describe("exports", () => {
    it("are references", () => {
      const refs = getRefs(18, "var x=1; export {x};");
      expect(refs).to.containSubset({
        decl: {start: 4, end: 7, type: "VariableDeclarator"},
        declId: {start: 4, end: 5, name: "x"}
      });
    });
  });
});
