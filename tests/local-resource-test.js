/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import LocalResource, { LocalResourceInMemoryBackend } from "../src/local-resource.js";
import { resource, createFiles } from "../index.js";

var testProjectSpec = {
  "file1.js": "foo bar",
  "sub-dir/file2.js": "zork",
  "sub-dir/sub-sub-dir/file3.js": "1234",
  "sub-dir/sub-sub-dir/file4.txt": "6789",
  "sub-dir/sub-sub-dir/sub-sub-sub-dir/file5.js": "zxxxx",
  "sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt": "yyyy"
};

var host = "test-local-host";

describe('local resource', function() {

  beforeEach(async () => {
    await LocalResourceInMemoryBackend.ensure(testProjectSpec, {host});
  });

  afterEach(() => {
    LocalResourceInMemoryBackend.removeHost(host)
  });

  it("can read a file", async () => {
    await LocalResourceInMemoryBackend.ensure({"test-location": {"foo": "foo bar"}}, {host});
    LocalResourceInMemoryBackend.named(host)
    var r = resource(`local://${host}/test-location/foo`);
    await r.read();

    expect(await r.read()).equals("foo bar");
  });


  it("can create and overwrite a file", async () => {
    var r = resource(`local://${host}/test-location/foo`);
    expect(await r.exists()).equals(false);
    expect(await r.read()).equals("");
    await r.write("test");
    expect(await r.exists()).equals(true);
    expect(await r.read()).equals("test");
    r.write("hello world")
    expect(await r.read()).equals("hello world");
  });


  it("cannot write a dir", async () => {
    var r = resource(`local://${host}/test-location/foo/`);
    try {
      await r.write("hello world");
    } catch (e) {
      expect(e).matches(/Cannot write/);
      return;
    }
    expect.fail("writing  a dir did no throw");
  });

  it("mkdir", async () => {
    var r = resource(`local://${host}/bar/`);
    await r.mkdir();
    expect((await r.parent().dirList()).map(ea => ea.url)).equals([
      r.parent().join("file1.js").url,
      r.parent().join("sub-dir/").url,
      r.parent().join("bar/").url,
    ]);
  });

  it("ensure existance of file non existing file deep", async () => {
    var r = resource(`local://${host}/test-location/bar/baz/foo.txt`);
    expect(await (await r.ensureExistance()).read()).equals("");
  });

  it("removes file", async () => {
    await LocalResourceInMemoryBackend.ensure({"foo": "foo bar"}, {host});
    var r = resource(`local://${host}/foo`);
    expect(await r.exists()).equals(true);
    await r.remove()
    expect(await r.exists()).equals(false);
  });

  it("removes recursively", async () => {
    var r = resource(`local://${host}/`);
    await r.join("sub-dir/").remove();
    expect((await r.dirList()).map(ea => ea.url)).deep.equals([
      r.join("file1.js").url
    ]);
  })

  it("creates files from spec", async () => {
    await createFiles("local:/test-location/foo", {
      "a.txt": "aaaa",
      "dir": {"b.txt": "bbbbb"}
    });
    expect(await resource("local:/test-location/foo/a.txt").read()).equals("aaaa");
    expect(await resource("local:/test-location/foo/dir/b.txt").read()).equals("bbbbb");
  });


  describe("file listing", async () => {

    it("of directory", async () => {
      var r = resource(`local://${host}/`);
      expect((await r.dirList()).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url,
      ]);
    });

    it("of directory recursively", async () => {
      var r = resource(`local://${host}/`);

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
      var r = resource(`local://${host}/sub-dir`);

      expect((await r.dirList('infinity')).map(ea => ea.url)).deep.equals([
        r.join("file2.js").url,
        r.join("sub-sub-dir/file3.js").url,
        r.join("sub-sub-dir/file4.txt").url,
        r.join("sub-sub-dir/sub-sub-sub-dir/file5.js").url,
        r.join("sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

    it("recursively up to a depth", async () => {
      var r = resource(`local://${host}/`);

      expect((await r.dirList(2)).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/file2.js").url,
        r.join("sub-dir/sub-sub-dir/").url
      ]);
    });

    it("list files with string filter", async () => {
      var r = resource(`local://${host}/`);
      expect((await r.dirList('infinity', {exclude: "sub-sub-dir"})).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/file2.js").url
      ]);
    });

    it("list files with function filter", async () => {
      var r = resource(`local://${host}/`);
      expect((await r.dirList('infinity', {exclude: res => res.name().endsWith(".js")})).map(ea => ea.url)).deep.equals([
        r.join("sub-dir/sub-sub-dir/file4.txt").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

  })

  xdescribe("file props", () => {

    it("retrieves file props", async () => {
      var {size, lastModified, contentType} = await r1.readProperties();
      expect(lively.lang.date.format(lastModified, "yyyy/mm/dd"))
        .equals(lively.lang.date.format(new Date(), "yyyy/mm/dd")); // beware those midnight test runs!

      if (contentType)
        expect(contentType).includes("application/javascript");
    });

    it("with dirList", async () => {
      var r = resource(`local://${host}/test-location/`),
          file1 = (await r.dirList())[0],
          {size, lastModified} = file1
      expect(+lastModified).greaterThan(Date.now() - 1000);
      expect(size).equals(7);
      expect((await r.dirList()).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url
      ]);
    });
  
  });


});
