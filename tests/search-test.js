/*global System, before, after, describe, it*/

import { expect } from "mocha-es6";

import { removeDir, createFiles } from "./helpers.js";
import { getSystem, module, searchLoadedModules } from "../src/system.js";

const dir = System.normalizeSync("lively.modules/tests/"),
      testProjectDir = dir + "test-project-dir/",
      testProjectSpec = {
        "file1.js": "import { y } from './file2.js';\nexport var x = 'hello';",
        "file2.js": "export var y = 'world'; // comment",
        "package.json": '{"name":"test-project-1","main":"file1.js"}'
      },
      file1m = testProjectDir + "file1.js",
      file2m = testProjectDir + "file2.js";

describe("search", () => {

  let S, module1, module2;
  before(async () => {
    S = getSystem("test", {baseURL: dir});
    module1 = module(S, file1m);
    module2 = module(S, file2m);
    await createFiles(testProjectDir, testProjectSpec);
  });

  after(async () => {
    await removeDir(testProjectDir);
  });

  describe("in modules", () => {
    
    it("finds string constants", async () => {
      const res = await module1.search("hello");
      expect(res).to.be.deep.eql([{
        file: file1m,
        line: 2,
        column: 16
      }]);
    });
    
    it("finds comments", async () => {
      const res = await module2.search("comment");
      expect(res).to.be.deep.eql([{
        file: file2m,
        line: 1,
        column: 27
      }]);
    })
  });
  
  describe("in all loaded modules", () => {
    
    it("does not find unloaded string constants", async () => {
      const res = await searchLoadedModules(S, "hello");
      expect(res).to.be.deep.eql([]);
    });
    
    it("finds string constants", async () => {
      await S.import(file1m);
      const res = await searchLoadedModules(S, "hello");
      expect(res).to.be.deep.eql([{
        file: file1m,
        line: 2,
        column: 16
      }]);
    });
    
    it("finds comments", async () => {
      await S.import(file1m);
      const res = await searchLoadedModules(S, "comment");
      expect(res).to.be.deep.eql([{
        file: file2m,
        line: 1,
        column: 27
      }]);
    });
    
    it("finds syntax", async () => {
      await S.import(file1m);
      await S.import(file2m);
      const res = await searchLoadedModules(S, "export");
      expect(res).to.be.deep.eql([{
        file: file1m,
        line: 2,
        column: 0
      },{
        file: file2m,
        line: 1,
        column: 0
      }]);
    });
  });


});