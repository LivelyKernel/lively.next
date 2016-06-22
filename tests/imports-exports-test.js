/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
import module from "../src/module.js";
import { registerPackage } from "../src/packages.js";

var dir = System.decanonicalize("lively.modules/tests/"),
    testProjectDir = dir + "test-dir-imports-exports/",
    testProjectSpec = {
      "package.json": '{"name": "imports-exports-test-project", "main": "file2.js"}',
      "file1.js": "var x = 1; var y = x;",
      
      "file2.js": "export var x = 1;",
      "file3.js": "import { x } from './file2.js'; var y = x;",
      "file4.js": "import { x as xx } from './file2.js'; var y = xx;",
      
      "file5.js": "export { x } from './file2.js';",
      "file6.js": "import { x } from './file5.js'; var y = x;",
      
      "file7.js": "export { x as xx } from './file2.js';",
      "file8.js": "import { xx } from './file7.js'; var y = xx;",
      
      "file9.js": "var x = 1; export { x };",
      "file10.js": "import { x } from './file9.js'; var y = x;",
      
      "file11.js": "export default 23;",
      "file12.js": "import x from './file11.js'; var y = x;",

      "file13.js": "var x = 1; export default x;",
      "file14.js": "import y from './file13.js'; var z = y;",
      
      "file15.js": "export default async function foo() {}",
      "file16.js": "import f from './file15.js'; f();",
      
      "file17.js": "export function bar() {}",
      "file18.js": "import { bar } from './file17.js'; bar();",
      
      "file19.js": "import { x } from './file2.js'; export { x };",
      "file20.js": "import { x } from './file19.js'; var y = x;",
      
      "file21.js": "import { x } from 'imports-exports-test-project'; var y = x;"

    };

describe("imports and exports", () => {

  var S, modules;
  beforeEach(() => {
    S = getSystem('import-export-test');
    modules = Object.keys(testProjectSpec)
                    .map(k => module(S, testProjectDir + k));
    return createFiles(testProjectDir, testProjectSpec)
  });
  afterEach(() => removeDir(testProjectDir));

  it("references within module", async () => {
    const decls = await modules[1].declarationsForRefAt(19);
    expect(decls).to.containSubset([{
      id : {start: 4, end: 5, name: "x"},
      start: 4,
      end: 9,
      module: {id: testProjectDir + "file1.js"}
    }]);
  });
  
  it("export named declaration", async () => {
    const decls = await modules[3].declarationsForRefAt(41);
    expect(decls).to.containSubset([{
      start: 9,
      end: 10,
      name: "x",
      module: {id: testProjectDir + "file3.js"}
    },{
      start: 11,
      end: 16,
      id: {start: 11, end: 12, name: "x"},
      module: {id: testProjectDir + "file2.js"}
    }]);
  });
  
  it("export named declaration as", async () => {
    const decls = await modules[4].declarationsForRefAt(47);
    expect(decls).to.containSubset([{
      start: 14,
      end: 16,
      name: "xx",
      module: {id: testProjectDir + "file4.js"}
    },{
      start: 11,
      end: 16,
      id: {start: 11, end: 12, name: "x"},
      module: {id: testProjectDir + "file2.js"}
    }]);
  });

  it("re-export named declaration", async () => {
    const decls = await modules[6].declarationsForRefAt(41);
    expect(decls).to.containSubset([{
      start: 9,
      end: 10,
      name: "x",
      module: {id: testProjectDir + "file6.js"}
    },{
      start: 11,
      end: 16,
      id: {start: 11, end: 12, name: "x"},
      module: {id: testProjectDir + "file2.js"}
    }]);
  });
  
  it("re-export named declaration as", async () => {
    const decls = await modules[8].declarationsForRefAt(42);
    expect(decls).to.containSubset([{
      start: 9,
      end: 11,
      name: "xx",
      module: {id: testProjectDir + "file8.js"}
    },{
      start: 11,
      end: 16,
      id: {start: 11, end: 12, name: "x"},
      module: {id: testProjectDir + "file2.js"}
    }]);
  });
  
  it("re-export indirectly", async () => {
    const decls = await modules[20].declarationsForRefAt(42);
    expect(decls).to.containSubset([{
      start: 9,
      end: 10,
      name: "x",
      module: {id: testProjectDir + "file20.js"}
    },{
      start: 9,
      end: 10,
      name: "x",
      module: {id: testProjectDir + "file19.js"}
    },{
      start: 11,
      end: 16,
      id: {start: 11, end: 12, name: "x"},
      module: {id: testProjectDir + "file2.js"}
    }]);
  });
  
  it("export named id", async () => {
    const decls = await modules[10].declarationsForRefAt(41);
    expect(decls).to.containSubset([{
      start: 9,
      end: 10,
      name: "x",
      module: {id: testProjectDir + "file10.js"}
    },{
      start: 4,
      end: 9,
      id: {start: 4, end: 5, name: "x"},
      module: {id: testProjectDir + "file9.js"}
    }]);
  });
  
  it("export default expr", async () => {
    const decls = await modules[12].declarationsForRefAt(38);
    expect(decls).to.containSubset([{
      start: 7,
      end: 8,
      name: "x",
      module: {id: testProjectDir + "file12.js"}
    },{
      start: 15,
      end: 17,
      type: "Literal",
      module: {id: testProjectDir + "file11.js"}
    }]);
  });

  it("export default id", async () => {
    const decls = await modules[14].declarationsForRefAt(38);
    expect(decls).to.containSubset([{
      start: 7,
      end: 8,
      name: "y",
      module: {id: testProjectDir + "file14.js"}
    },{
      start: 4,
      end: 9,
      id: {start: 4, end: 5, name: "x"},
      module: {id: testProjectDir + "file13.js"}
    }]);
  });
  
  it("export default function", async () => {
    const decls = await modules[16].declarationsForRefAt(30);
    expect(decls).to.containSubset([{
      start: 7,
      end: 8,
      name: "f",
      module: {id: testProjectDir + "file16.js"}
    },{
      start: 15,
      end: 38,
      type: "FunctionDeclaration",
      module: {id: testProjectDir + "file15.js"}
    }]);
  });
  
  it("export named function", async () => {
    const decls = await modules[18].declarationsForRefAt(36);
    expect(decls).to.containSubset([{
      start: 9,
      end: 12,
      name: "bar",
      module: {id: testProjectDir + "file18.js"}
    },{
      start: 7,
      end: 24,
      type: "FunctionDeclaration",
      module: {id: testProjectDir + "file17.js"}
    }]);
  });
  
  it("export named declaration from package", async () => {
    await registerPackage(S, testProjectDir);
    const decls = await modules[21].declarationsForRefAt(59);
    expect(decls).to.containSubset([{
      start: 9,
      end: 10,
      name: "x",
      module: {id: testProjectDir + "file21.js"}
    },{
      start: 11,
      end: 16,
      id: {start: 11, end: 12, name: "x"},
      module: {id: testProjectDir + "file2.js"}
    }]);
  });
});
