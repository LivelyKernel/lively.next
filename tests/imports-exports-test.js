/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
import module from "../src/module.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-dir-imports-exports/",
    testProjectSpec = {
      "file1.js": "import { y as yyy } from './file2.js'; export var x = yyy + z;",
      "file2.js": "export var y = 1;",
      "file3.js": "export { x } from './file1.js';",
      "file4.js": "import * as file2 from './file2.js'; export * from './file1.js'",
      "file5.js": "export default async function foo() {}",
      "file6.js": "export function bar() {}",
      "file7.js": "export class Baz {}",
      "package.json": '{"name": "imports-exports-test-project", "main": "file1.js"}'
    };

describe("imports and exports", () => {

  var S, module1, module2, module3, module4, module5, module6, module7;
  beforeEach(() => {
    S = getSystem('import-export-test');
    module1 = module(S, testProjectDir + "file1.js"),
    module2 = module(S, testProjectDir + "file2.js"),
    module3 = module(S, testProjectDir + "file3.js"),
    module4 = module(S, testProjectDir + "file4.js"),
    module5 = module(S, testProjectDir + "file5.js"),
    module6 = module(S, testProjectDir + "file6.js"),
    module7 = module(S, testProjectDir + "file7.js");
    return createFiles(testProjectDir, testProjectSpec)
  });
  afterEach(() => removeDir(testProjectDir));

  it("exports of var decls", async () => {
    var result = await module1.exports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({exported: "x", local: "x", type: "var"});
  });

  it("exports * from", async () => {
    var result = await module4.exports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({exported: "*", fromModule: "./file1.js", local: null});
  });

  it("exports named from", async () => {
    var result = await module3.exports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({exported: "x", fromModule: "./file1.js", local: null});
  });

  it("exports functions", async () => {
    var result = await module6.exports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({exported: "bar", local: "bar", type: "function"});
  });

  it("exports default function", async () => {
    var result = await module5.exports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({exported: "foo", local: "foo", type: "function"});
  });

  it("exports class", async () => {
    var result = await module7.exports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({exported: "Baz", local: "Baz", type: "class"});
  });

  it("imports of named vars", async () => {
    var result = await module1.imports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({fromModule: "./file2.js", imported: 'y', local: "yyy"});
  });


  it("imports *", async () => {
    var result = await module4.imports();
    expect(result).to.have.length(1);
    expect(result[0]).to.containSubset({fromModule: "./file2.js", imported: "*", local: "file2"});
  });

})
