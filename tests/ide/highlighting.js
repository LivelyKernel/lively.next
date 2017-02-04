/*global describe, beforeEach, it*/
import { expect } from "mocha-es6";

import { Token } from "../../ide/highlighting.js";
import JavaScriptTokenizer from "../../ide/js/highlighter.js";

describe("javascript highlighting", () => {
  
  let tokenizer;
  beforeEach(() => {
    tokenizer = new JavaScriptTokenizer();
  });

  it("matches numerics", () => {
    const src = `23 + 12`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.numeric, start: {row: 0, column: 0}, end: {row: 0, column: 2}},
      {token: Token.default, start: {row: 0, column: 2}, end: {row: 0, column: 5}},
      {token: Token.numeric, start: {row: 0, column: 5}, end: {row: 0, column: 7}}
    ]);
  });
  
  it("matches identifiers", () => {
    const src = `x.y`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.id, start: {row: 0, column: 0}, end: {row: 0, column: 1}},
      {token: Token.default, start: {row: 0, column: 1}, end: {row: 0, column: 2}},
      {token: Token.id, start: {row: 0, column: 2}, end: {row: 0, column: 3}}
    ]);
  });
  
  it("matches single-quoted strings", () => {
    const src = `'"' + '\\''`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.string, start: {row: 0, column: 0}, end: {row: 0, column: 3}},
      {token: Token.default, start: {row: 0, column: 3}, end: {row: 0, column: 6}},
      {token: Token.string, start: {row: 0, column: 6}, end: {row: 0, column: 10}}
    ]);
  });
  
  it("matches double-quoted strings", () => {
    const src = `"'" + "\\""`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.string, start: {row: 0, column: 0}, end: {row: 0, column: 3}},
      {token: Token.default, start: {row: 0, column: 3}, end: {row: 0, column: 6}},
      {token: Token.string, start: {row: 0, column: 6}, end: {row: 0, column: 10}}
    ]);
  });
  
  it("limits strings to single lines", () => {
    const src = `"t\nr"`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.string, start: {row: 0, column: 0}, end: {row: 0, column: 2}},
      {token: Token.error, start: {row: 0, column: 2}, end: {row: 1, column: 0}},
      {token: Token.id, start: {row: 1, column: 0}, end: {row: 1, column: 1}},
      {token: Token.string, start: {row: 1, column: 1}, end: {row: 1, column: 2}}
    ]);
  });
  
  it("limits strings to single lines unless escaped", () => {
    const src = `"t\\\nr"`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.string, start: {row: 0, column: 0}, end: {row: 1, column: 2}}
    ]);
  });
  
  it("matches simple templates", () => {
    const src = '`x` + `\\``';
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.string, start: {row: 0, column: 0}, end: {row: 0, column: 3}},
      {token: Token.default, start: {row: 0, column: 3}, end: {row: 0, column: 6}},
      {token: Token.string, start: {row: 0, column: 6}, end: {row: 0, column: 10}}
    ]);
  });
  
  it("matches multi-line templates", () => {
    const src = '`x\ny`';
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.string, start: {row: 0, column: 0}, end: {row: 1, column: 2}}
    ]);
  });
  
  it("matches templates with interpolation", () => {
    const src = 'let x = 23; `${{x231:x}[`x${x+`${2-1}`}`]}`';
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.keyword, start: {row: 0, column: 0}, end: {row: 0, column: 3}},
      {token: Token.default, start: {row: 0, column: 3}, end: {row: 0, column: 4}},
      {token: Token.id, start: {row: 0, column: 4}, end: {row: 0, column: 5}},
      {token: Token.default, start: {row: 0, column: 5}, end: {row: 0, column: 8}},
      {token: Token.numeric, start: {row: 0, column: 8}, end: {row: 0, column: 10}},
      {token: Token.default, start: {row: 0, column: 10}, end: {row: 0, column: 12}},
      {token: Token.string, start: {row: 0, column: 12}, end: {row: 0, column: 13}},
      {token: Token.default, start: {row: 0, column: 13}, end: {row: 0, column: 16}},
      {token: Token.id, start: {row: 0, column: 16}, end: {row: 0, column: 20}},
      {token: Token.default, start: {row: 0, column: 20}, end: {row: 0, column: 21}},
      {token: Token.id, start: {row: 0, column: 21}, end: {row: 0, column: 22}},
      {token: Token.default, start: {row: 0, column: 22}, end: {row: 0, column: 24}},
      {token: Token.string, start: {row: 0, column: 24}, end: {row: 0, column: 26}},
      {token: Token.default, start: {row: 0, column: 26}, end: {row: 0, column: 28}},
      {token: Token.id, start: {row: 0, column: 28}, end: {row: 0, column: 29}},
      {token: Token.default, start: {row: 0, column: 29}, end: {row: 0, column: 30}},
      {token: Token.string, start: {row: 0, column: 30}, end: {row: 0, column: 31}},
      {token: Token.default, start: {row: 0, column: 31}, end: {row: 0, column: 33}},
      {token: Token.numeric, start: {row: 0, column: 33}, end: {row: 0, column: 34}},
      {token: Token.default, start: {row: 0, column: 34}, end: {row: 0, column: 35}},
      {token: Token.numeric, start: {row: 0, column: 35}, end: {row: 0, column: 36}},
      {token: Token.default, start: {row: 0, column: 36}, end: {row: 0, column: 37}},
      {token: Token.string, start: {row: 0, column: 37}, end: {row: 0, column: 38}},
      {token: Token.default, start: {row: 0, column: 38}, end: {row: 0, column: 39}},
      {token: Token.string, start: {row: 0, column: 39}, end: {row: 0, column: 40}},
      {token: Token.default, start: {row: 0, column: 40}, end: {row: 0, column: 42}},
      {token: Token.string, start: {row: 0, column: 42}, end: {row: 0, column: 43}}
    ]);
  });
  
  it("matches comments", () => {
    const src = "this.renderer/*not init'ed yet*/) return";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.dynamic, start: {row: 0, column: 0}, end: {row: 0, column: 4}},
      {token: Token.default, start: {row: 0, column: 4}, end: {row: 0, column: 5}},
      {token: Token.id, start: {row: 0, column: 5}, end: {row: 0, column: 13}},
      {token: Token.comment, start: {row: 0, column: 13}, end: {row: 0, column: 32}},
      {token: Token.default, start: {row: 0, column: 32}, end: {row: 0, column: 34}},
      {token: Token.keyword, start: {row: 0, column: 34}, end: {row: 0, column: 40}}
    ]);
  });
  
  it("matches line comments", () => {
    const src = "this// comment\nends";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.dynamic, start: {row: 0, column: 0}, end: {row: 0, column: 4}},
      {token: Token.comment, start: {row: 0, column: 4}, end: {row: 1, column: 0}},
      {token: Token.id, start: {row: 1, column: 0}, end: {row: 1, column: 4}}
    ]);
  });
  
  it("ignores urls in line comments", () => {
    const src = "// http://abc/123";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.comment, start: {row: 0, column: 0}, end: {row: 0, column: 17}}
    ]);
  });
  
  it("matches keywords", () => {
    const src = "return 1";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.keyword, start: {row: 0, column: 0}, end: {row: 0, column: 6}},
      {token: Token.default, start: {row: 0, column: 6}, end: {row: 0, column: 7}},
      {token: Token.numeric, start: {row: 0, column: 7}, end: {row: 0, column: 8}}
    ]);
  });
  
  it("matches constants", () => {
    const src = "!true";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.default, start: {row: 0, column: 0}, end: {row: 0, column: 1}},
      {token: Token.constant, start: {row: 0, column: 1}, end: {row: 0, column: 5}}
    ]);
  });
  
  it("matches globals", () => {
    const src = "Math.max()";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.global, start: {row: 0, column: 0}, end: {row: 0, column: 4}},
      {token: Token.default, start: {row: 0, column: 4}, end: {row: 0, column: 5}},
      {token: Token.id, start: {row: 0, column: 5}, end: {row: 0, column: 8}},
      {token: Token.default, start: {row: 0, column: 8}, end: {row: 0, column: 10}}
    ]);
  });

  it("matches dynamic", () => {
    const src = "this.x";
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.dynamic, start: {row: 0, column: 0}, end: {row: 0, column: 4}},
      {token: Token.default, start: {row: 0, column: 4}, end: {row: 0, column: 5}},
      {token: Token.id, start: {row: 0, column: 5}, end: {row: 0, column: 6}}
    ]);
  });
  
  it("matches simple regular expressions", () => {
    const src = `/x|y/g.test("x")`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.regex, start: {row: 0, column: 0}, end: {row: 0, column: 6}},
      {token: Token.default, start: {row: 0, column: 6}, end: {row: 0, column: 7}},
      {token: Token.id, start: {row: 0, column: 7}, end: {row: 0, column: 11}},
      {token: Token.default, start: {row: 0, column: 11}, end: {row: 0, column: 12}},
      {token: Token.string, start: {row: 0, column: 12}, end: {row: 0, column: 15}},
      {token: Token.default, start: {row: 0, column: 15}, end: {row: 0, column: 16}}
    ]);
  });
  
  it("supports import statements", () => {
    const src = `import { x } from "x.js";`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.keyword, start: {row: 0, column: 0}, end: {row: 0, column: 6}},
      {token: Token.default, start: {row: 0, column: 6}, end: {row: 0, column: 9}},
      {token: Token.id, start: {row: 0, column: 9}, end: {row: 0, column: 10}},
      {token: Token.default, start: {row: 0, column: 10}, end: {row: 0, column: 13}},
      {token: Token.keyword, start: {row: 0, column: 13}, end: {row: 0, column: 17}},
      {token: Token.default, start: {row: 0, column: 17}, end: {row: 0, column: 18}},
      {token: Token.string, start: {row: 0, column: 18}, end: {row: 0, column: 24}},
      {token: Token.default, start: {row: 0, column: 24}, end: {row: 0, column: 25}}
    ]);
  });
  
  it("recognizes comments after divide operator", () => {
    const src = `a / 2\n/*x*/`;
    expect(tokenizer.tokenize(src)).to.be.deep.equal([
      {token: Token.id, start: {row: 0, column: 0}, end: {row: 0, column: 1}},
      {token: Token.default, start: {row: 0, column: 1}, end: {row: 0, column: 4}},
      {token: Token.numeric, start: {row: 0, column: 4}, end: {row: 0, column: 5}},
      {token: Token.default, start: {row: 0, column: 5}, end: {row: 1, column: 0}},
      {token: Token.comment, start: {row: 1, column: 0}, end: {row: 1, column: 5}}
    ]);
  });
  
});
