/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { resource, createFiles } from "../index.js";

var dir = System.normalizeSync("lively.resources/tests/"),
    testProjectDir = dir + "temp-for-tests/",
    testProjectSpec = {
      "file1.js": "foo bar",
      "sub-dir": {"file2.js": "zork"}
    };

describe('http', function() {

  var r1;
  beforeEach(async () => {
    await createFiles(testProjectDir, testProjectSpec);
    r1 = resource(testProjectDir + "file1.js");
  });
  
  afterEach(async () => {
    await resource(testProjectDir).remove();
  });

  it("can read a file", async () => {
    expect(await r1.read()).equals("foo bar");
  });

  it("can overwrite a file", async () => {
    await r1.write("hello world")
    expect(await r1.read()).equals("hello world");
    expect(await r1.read()).equals("hello world");
  });

  it("can create a new file", async () => {
    var r = resource(testProjectDir + "new-file.js");
    expect(await r.exists()).equals(false, "exists before");
    await r.write("hello world")
    expect(await r.exists()).equals(true, "exists after");
    expect(await r.read()).equals("hello world");
  });

  it("cannot write a dir", async () => {
    var r = resource(testProjectDir + "new-sub-dir/");
    try {
      await r.write("hello world");
    } catch (e) {
      expect(e).matches(/Cannot write/);
      return;
    }
    expect.fail("writing  a dir did no throw");
  });

  it("ensure existance of file non existing file", async () => {
    expect(await (await resource(testProjectDir + "foo.txt").ensureExistance()).read()).equals("");
  });

  it("ensure existance of file non existing file deep", async () => {
    expect(await (await resource(testProjectDir + "bar/baz/foo.txt").ensureExistance()).read()).equals("");
  });

  it("ensure existance of existing file", async () => {
    expect(await (await r1.ensureExistance()).read()).equals("foo bar");
  });

  it("removes file", async () => {
    expect(await (await r1.remove()).exists()).equals(false);
  })

  it("removes non-existing file", async () => {
    try {
      await resource(testProjectDir + "non-existing-file").remove();
    } catch (e) {
      expect.fail(null,null, "remove on non existing file throws error: " + e)
    }
  })

  it("removes dir", async () => {
    expect(await (await resource(testProjectDir).remove()).exists()).equals(false);
  });

  it("creates files from spec", async () => {
    await createFiles(testProjectDir, {
      "a.txt": "aaaa",
      "dir": {"b.txt": "bbbbb"}
    })
    expect(await resource(testProjectDir + "a.txt").read()).equals("aaaa");
    expect(await resource(testProjectDir + "dir/b.txt").read()).equals("bbbbb");
  });

});
