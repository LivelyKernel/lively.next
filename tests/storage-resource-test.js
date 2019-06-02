/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { StorageDatabase } from "../storage-resource.js";
import { resource, createFiles } from "lively.resources";

var dbName = "test-storage-db", db;

describe("lively.storage resource", () => {

  beforeEach(async () => {
    db = StorageDatabase.ensureDB(dbName, {adapter: "memory"});
  });

  afterEach(() => db && db.destroy());

  it("can read a file", async () => {
    await db.set("/test-location/foo", {content: "foo bar"});
    var r = resource(`lively.storage://${dbName}/test-location/foo`);
    expect(await r.read()).equals("foo bar");
  });


  it("can create and overwrite a file", async () => {
    var r = resource(`lively.storage://${dbName}/test-location/foo`);
    expect(await r.exists()).equals(false);
    expect(await r.read()).equals("");
    await r.write("test");
    expect(await r.exists()).equals(true);
    expect(await r.read()).equals("test");
    await r.write("hello world")
    expect(await r.read()).equals("hello world");
  });

  it("cannot write a dir", async () => {
    var r = resource(`lively.storage://${dbName}/test-location/foo/`);
    try {
      await r.write("hello world");
    } catch (e) {
      expect(e).matches(/Cannot write/);
      return;
    }
    expect.fail("writing  a dir did no throw");
  });

  it("mkdir", async () => {
    await resource(`lively.storage://${dbName}/foo/`).mkdir();
    await resource(`lively.storage://${dbName}/bar/`).mkdir();
    expect((await resource(`lively.storage://${dbName}`).dirList()).map(ea => ea.url)).equals([
      `lively.storage://${dbName}/bar/`,
      `lively.storage://${dbName}/foo/`,
    ]);
  });

  it("ensure existance of file non existing file deep", async () => {
    var r = resource(`lively.storage://${dbName}/test-location/bar/baz/foo.txt`);
    expect(await (await r.ensureExistance()).read()).equals("");
  });

  it("removes file", async () => {
    await resource(`lively.storage://${dbName}/foo`).write("foo bar");
    r = resource(`lively.storage://${dbName}/foo`)
    await r.db.getAll({startkey: r.path()})

    var r = resource(`lively.storage://${dbName}/foo`);
    expect(await r.exists()).equals(true);
    await r.remove()
    expect(await r.exists()).equals(false);
  });

  it("removes recursively", async () => {
    await resource(`lively.storage://${dbName}/oink/`).mkdir();
    await resource(`lively.storage://${dbName}/foo/`).mkdir();
    await resource(`lively.storage://${dbName}/foo/bar/`).mkdir();
    await resource(`lively.storage://${dbName}/foo/bar/baz/`).mkdir();
    await resource(`lively.storage://${dbName}/foo/bar/baz/zork`).write("xxxx");
    var r = resource(`lively.storage://${dbName}/`);
    await r.join("foo/").remove();
    expect((await r.dirList('infinity')).map(ea => ea.url)).deep.equals([
      `lively.storage://${dbName}/oink/`
    ]);
  });

  it("creates files from spec", async () => {
    await createFiles(`lively.storage://${dbName}/foo`, {
      "a.txt": "aaaa",
      "dir": {"b.txt": "bbbbb"}
    });
    expect(await resource(`lively.storage://${dbName}/foo/a.txt`).read()).equals("aaaa");
    expect(await resource(`lively.storage://${dbName}/foo/dir/b.txt`).read()).equals("bbbbb");
  });


  describe("file listing", async () => {

    let testProjectSpec = {
      "file1.js": "foo bar",
      "sub-dir/file2.js": "zork",
      "sub-dir/sub-sub-dir/file3.js": "1234",
      "sub-dir/sub-sub-dir/file4.txt": "6789",
      "sub-dir/sub-sub-dir/sub-sub-sub-dir/file5.js": "zxxxx",
      "sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt": "yyyy"
    };

    beforeEach(async () => {
      await createFiles(`lively.storage://${dbName}/`, testProjectSpec);
    });

    it("of directory", async () => {
      var r = resource(`lively.storage://${dbName}/`);
      expect((await r.dirList()).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url,
      ]);
    });

    it("of directory recursively", async () => {
      var r = resource(`lively.storage://${dbName}/`);

      expect((await r.dirList('infinity')).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/file2.js").url,
        r.join("sub-dir/sub-sub-dir/file3.js").url,
        r.join("sub-dir/sub-sub-dir/file4.txt").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file5.js").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

    it("of subdirectory recursively", async () => {
      var r = resource(`lively.storage://${dbName}/sub-dir`);

      expect((await r.dirList('infinity')).map(ea => ea.url)).deep.equals([
        r.join("file2.js").url,
        r.join("sub-sub-dir/file3.js").url,
        r.join("sub-sub-dir/file4.txt").url,
        r.join("sub-sub-dir/sub-sub-sub-dir/file5.js").url,
        r.join("sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

    it("recursively up to a depth", async () => {
      var r = resource(`lively.storage://${dbName}/`);

      expect((await r.dirList(2)).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/file2.js").url,
        r.join("sub-dir/sub-sub-dir/").url
      ]);
    });

    it("list files with string filter", async () => {
      var r = resource(`lively.storage://${dbName}/`);
      expect((await r.dirList('infinity', {exclude: "sub-sub-dir"})).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/file2.js").url
      ]);
    });

    it("list files with function filter", async () => {
      var r = resource(`lively.storage://${dbName}/`);
      expect((await r.dirList('infinity', {exclude: res => res.name().endsWith(".js")})).map(ea => ea.url)).deep.equals([
        r.join("sub-dir/sub-sub-dir/file4.txt").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

  })

  describe("file props", () => {

    let testProjectSpec = {
      "file1.js": "foo bar",
      "sub-dir/file2.js": "zork",
      "sub-dir/sub-sub-dir/file3.js": "1234",
      "sub-dir/sub-sub-dir/file4.txt": "6789",
      "sub-dir/sub-sub-dir/sub-sub-sub-dir/file5.js": "zxxxx",
      "sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt": "yyyy"
    };

    beforeEach(async () => {
      await createFiles(`lively.storage://${dbName}/`, testProjectSpec);
    });

    it("retrieves file props", async () => {
      let r = resource(`lively.storage://${dbName}/file1.js`);
      var {size, lastModified, contentType} = await r.readProperties();
      expect(lively.lang.date.format(lastModified, "yyyy/mm/dd"))
        .equals(lively.lang.date.format(new Date(), "yyyy/mm/dd")); // beware those midnight test runs!

      if (contentType)
        expect(contentType).includes("application/javascript");
    });

    it("with dirList", async () => {
      var r = resource(`lively.storage://${dbName}/sub-dir/`),
          file1 = (await r.dirList())[0],
          {size, lastModified} = file1;
      expect(+lastModified).greaterThan(Date.now() - 1000);
      expect(size).equals(4);
    });

  });

  describe("json handling", () => {

    it("directly stores json", async () => {
      let r = resource(`lively.storage://${dbName}/test.json`),
          json = {foo: 23, bar: {baz: "zork"}};
      await r.writeJson(json);
      let doc = await r.db.get(r.path());
      expect(doc.content).deep.equals(json);
      expect(await r.readJson()).deep.equals(json);
      expect(typeof await r.read()).equals("string");
    })

  });

});
