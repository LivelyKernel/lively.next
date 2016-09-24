/*global describe, beforeEach, it*/
import { expect } from "mocha-es6";

import { Token } from "../../ide/highlighting.js";
import JavaScriptHighlighting from "../../ide/modes/javascript-highlighter.js";

describe("javascript highlighting", () => {
  
  let mode;
  beforeEach(() => {
    mode = new JavaScriptHighlighting();
  });

  it("matches numerics", () => {
    const src = `23 + 12`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.numeric, from: {row: 0, column: 0}, to: {row: 0, column: 2}},
      {token: Token.default, from: {row: 0, column: 2}, to: {row: 0, column: 5}},
      {token: Token.numeric, from: {row: 0, column: 5}, to: {row: 0, column: 7}}
    ]);
  });
  
  it("matches identifiers", () => {
    const src = `x.y`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.id, from: {row: 0, column: 0}, to: {row: 0, column: 1}},
      {token: Token.default, from: {row: 0, column: 1}, to: {row: 0, column: 2}},
      {token: Token.id, from: {row: 0, column: 2}, to: {row: 0, column: 3}}
    ]);
  });
  
  it("matches single-quoted strings", () => {
    const src = `'"' + '\\''`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.string, from: {row: 0, column: 0}, to: {row: 0, column: 3}},
      {token: Token.default, from: {row: 0, column: 3}, to: {row: 0, column: 6}},
      {token: Token.string, from: {row: 0, column: 6}, to: {row: 0, column: 10}}
    ]);
  });
  
  it("matches double-quoted strings", () => {
    const src = `"'" + "\\""`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.string, from: {row: 0, column: 0}, to: {row: 0, column: 3}},
      {token: Token.default, from: {row: 0, column: 3}, to: {row: 0, column: 6}},
      {token: Token.string, from: {row: 0, column: 6}, to: {row: 0, column: 10}}
    ]);
  });
  
  it("limits strings to single lines", () => {
    const src = `"t\nr"`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.string, from: {row: 0, column: 0}, to: {row: 0, column: 2}},
      {token: Token.error, from: {row: 0, column: 2}, to: {row: 1, column: 0}},
      {token: Token.id, from: {row: 1, column: 0}, to: {row: 1, column: 1}},
      {token: Token.string, from: {row: 1, column: 1}, to: {row: 1, column: 2}}
    ]);
  });
  
  it("limits strings to single lines unless escaped", () => {
    const src = `"t\\\nr"`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.string, from: {row: 0, column: 0}, to: {row: 1, column: 2}}
    ]);
  });
  
  it("matches simple templates", () => {
    const src = '`x` + `\\``';
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.string, from: {row: 0, column: 0}, to: {row: 0, column: 3}},
      {token: Token.default, from: {row: 0, column: 3}, to: {row: 0, column: 6}},
      {token: Token.string, from: {row: 0, column: 6}, to: {row: 0, column: 10}}
    ]);
  });
  
  it("matches multi-line templates", () => {
    const src = '`x\ny`';
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.string, from: {row: 0, column: 0}, to: {row: 1, column: 2}}
    ]);
  });
  
  it("matches templates with interpolation", () => {
    const src = 'let x = 23; `${{x231:x}[`x${x+`${2-1}`}`]}`';
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.keyword, from: {row: 0, column: 0}, to: {row: 0, column: 3}},
      {token: Token.default, from: {row: 0, column: 3}, to: {row: 0, column: 4}},
      {token: Token.id, from: {row: 0, column: 4}, to: {row: 0, column: 5}},
      {token: Token.default, from: {row: 0, column: 5}, to: {row: 0, column: 8}},
      {token: Token.numeric, from: {row: 0, column: 8}, to: {row: 0, column: 10}},
      {token: Token.default, from: {row: 0, column: 10}, to: {row: 0, column: 12}},
      {token: Token.string, from: {row: 0, column: 12}, to: {row: 0, column: 13}},
      {token: Token.default, from: {row: 0, column: 13}, to: {row: 0, column: 16}},
      {token: Token.id, from: {row: 0, column: 16}, to: {row: 0, column: 20}},
      {token: Token.default, from: {row: 0, column: 20}, to: {row: 0, column: 21}},
      {token: Token.id, from: {row: 0, column: 21}, to: {row: 0, column: 22}},
      {token: Token.default, from: {row: 0, column: 22}, to: {row: 0, column: 24}},
      {token: Token.string, from: {row: 0, column: 24}, to: {row: 0, column: 26}},
      {token: Token.default, from: {row: 0, column: 26}, to: {row: 0, column: 28}},
      {token: Token.id, from: {row: 0, column: 28}, to: {row: 0, column: 29}},
      {token: Token.default, from: {row: 0, column: 29}, to: {row: 0, column: 30}},
      {token: Token.string, from: {row: 0, column: 30}, to: {row: 0, column: 31}},
      {token: Token.default, from: {row: 0, column: 31}, to: {row: 0, column: 33}},
      {token: Token.numeric, from: {row: 0, column: 33}, to: {row: 0, column: 34}},
      {token: Token.default, from: {row: 0, column: 34}, to: {row: 0, column: 35}},
      {token: Token.numeric, from: {row: 0, column: 35}, to: {row: 0, column: 36}},
      {token: Token.default, from: {row: 0, column: 36}, to: {row: 0, column: 37}},
      {token: Token.string, from: {row: 0, column: 37}, to: {row: 0, column: 38}},
      {token: Token.default, from: {row: 0, column: 38}, to: {row: 0, column: 39}},
      {token: Token.string, from: {row: 0, column: 39}, to: {row: 0, column: 40}},
      {token: Token.default, from: {row: 0, column: 40}, to: {row: 0, column: 42}},
      {token: Token.string, from: {row: 0, column: 42}, to: {row: 0, column: 43}}
    ]);
  });
  
  it("matches comments", () => {
    const src = "this.renderer/*not init'ed yet*/) return";
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.dynamic, from: {row: 0, column: 0}, to: {row: 0, column: 4}},
      {token: Token.default, from: {row: 0, column: 4}, to: {row: 0, column: 5}},
      {token: Token.id, from: {row: 0, column: 5}, to: {row: 0, column: 13}},
      {token: Token.comment, from: {row: 0, column: 13}, to: {row: 0, column: 32}},
      {token: Token.default, from: {row: 0, column: 32}, to: {row: 0, column: 34}},
      {token: Token.keyword, from: {row: 0, column: 34}, to: {row: 0, column: 40}}
    ]);
  });
  
  it("matches line comments", () => {
    const src = "this// comment\nends";
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.dynamic, from: {row: 0, column: 0}, to: {row: 0, column: 4}},
      {token: Token.comment, from: {row: 0, column: 4}, to: {row: 1, column: 0}},
      {token: Token.id, from: {row: 1, column: 0}, to: {row: 1, column: 4}}
    ]);
  });
  
  it("matches keywords", () => {
    const src = "return 1";
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.keyword, from: {row: 0, column: 0}, to: {row: 0, column: 6}},
      {token: Token.default, from: {row: 0, column: 6}, to: {row: 0, column: 7}},
      {token: Token.numeric, from: {row: 0, column: 7}, to: {row: 0, column: 8}}
    ]);
  });
  
  it("matches constants", () => {
    const src = "!true";
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.default, from: {row: 0, column: 0}, to: {row: 0, column: 1}},
      {token: Token.constant, from: {row: 0, column: 1}, to: {row: 0, column: 5}}
    ]);
  });
  
  it("matches globals", () => {
    const src = "Math.max()";
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.global, from: {row: 0, column: 0}, to: {row: 0, column: 4}},
      {token: Token.default, from: {row: 0, column: 4}, to: {row: 0, column: 5}},
      {token: Token.id, from: {row: 0, column: 5}, to: {row: 0, column: 8}},
      {token: Token.default, from: {row: 0, column: 8}, to: {row: 0, column: 10}}
    ]);
  });

  it("matches dynamic", () => {
    const src = "this.x";
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.dynamic, from: {row: 0, column: 0}, to: {row: 0, column: 4}},
      {token: Token.default, from: {row: 0, column: 4}, to: {row: 0, column: 5}},
      {token: Token.id, from: {row: 0, column: 5}, to: {row: 0, column: 6}}
    ]);
  });
  
  it("matches simple regular expressions", () => {
    const src = `/x|y/g.test("x")`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.regex, from: {row: 0, column: 0}, to: {row: 0, column: 6}},
      {token: Token.default, from: {row: 0, column: 6}, to: {row: 0, column: 7}},
      {token: Token.id, from: {row: 0, column: 7}, to: {row: 0, column: 11}},
      {token: Token.default, from: {row: 0, column: 11}, to: {row: 0, column: 12}},
      {token: Token.string, from: {row: 0, column: 12}, to: {row: 0, column: 15}},
      {token: Token.default, from: {row: 0, column: 15}, to: {row: 0, column: 16}}
    ]);
  });
  
  it("supports import statements", () => {
    const src = `import { x } from "x.js";`;
    expect(mode.highlight(src)).to.be.deep.equal([
      {token: Token.keyword, from: {row: 0, column: 0}, to: {row: 0, column: 6}},
      {token: Token.default, from: {row: 0, column: 6}, to: {row: 0, column: 9}},
      {token: Token.id, from: {row: 0, column: 9}, to: {row: 0, column: 10}},
      {token: Token.default, from: {row: 0, column: 10}, to: {row: 0, column: 13}},
      {token: Token.keyword, from: {row: 0, column: 13}, to: {row: 0, column: 17}},
      {token: Token.default, from: {row: 0, column: 17}, to: {row: 0, column: 18}},
      {token: Token.string, from: {row: 0, column: 18}, to: {row: 0, column: 24}},
      {token: Token.default, from: {row: 0, column: 24}, to: {row: 0, column: 25}}
    ]);
  });
  
});
