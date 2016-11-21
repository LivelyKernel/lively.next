/*global declare, it, describe, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { arr } from "lively.lang";
import { convertToTextStyles, stripAnsiAttributes } from "../ansi-color-parser.js";

var esc = String.fromCharCode(27); // "\033"

describe("ansi color parsing", () => {

  it("strips ansu attributes", () => {
    expect(stripAnsiAttributes(`hello${esc}[31mworld${esc}[0m`)).equals("helloworld");
  })

  it("parse simple colors", function() {
    var string = `hello${esc}[31mworld${esc}[0m`,
        expectedTextSpec = {
          string: 'helloworld',
          ranges: [[0,5, {}], [5, 10, {color: "red"}]]},
        result = convertToTextStyles(string);

    expect(expectedTextSpec).deep.equals(result);
  })

  it("parse two text attributes", function() {
    var string = `hello${esc}[4;31mwor${esc}[44mld${esc}[0m`,
        expectedTextSpec = {
          string: 'helloworld',
          ranges: [
            [0, 5, {}],
            [5,8, {textDecoration: 'underline', color: "red"}],
            [8,10, {textDecoration: 'underline', color: "red", backgroundColor: "blue"}]]},
        result = convertToTextStyles(string);
    expect(expectedTextSpec).deep.equals(result);
  })

  it("ansi attributes can deal with missing end", function() {
    var string = `${esc}[31mhelloworld`,
        expectedTextSpec = {
          string: 'helloworld',
          ranges: [[0,10, {color: "red"}]]},
        result = convertToTextStyles(string);
    expect(expectedTextSpec).deep.equals(result);
  })

});