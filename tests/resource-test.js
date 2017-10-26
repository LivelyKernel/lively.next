/*global beforeEach, afterEach, describe, it,System*/

import { expect } from "mocha-es6";

import { resource, createFiles, registerExtension, unregisterExtension } from "../index.js";
import Resource from "../src/resource.js";
import { relativePathBetween } from "../src/helpers.js";

var dir = System.normalizeSync("lively.resources/tests/"),
    testProjectDir = dir + "temp-for-tests/",
    testProjectSpec = {
      "file1.js": "foo bar",
      "sub-dir": {
        "file2.js": "zork",
        "sub-sub-dir": {
          "file3.js": "1234",
          "file4.txt": "6789",
          "sub-sub-sub-dir": {
            "file5.js": "zxxxx",
            "file6.txt": "yyyy"
          }
        }
      }
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

  it("retrieves file props", async () => {
    var {size, lastModified, contentType} = await r1.readProperties();    
    expect(lively.lang.date.format(lastModified, "yyyy/mm/dd"))
      .equals(lively.lang.date.format(new Date(), "yyyy/mm/dd")); // beware those midnight test runs!

    if (contentType)
      expect(contentType).includes("application/javascript");
  });

  describe("file listing", () => {

    it("of directory", async () => {
      var r = resource(testProjectDir);
      expect((await r.dirList()).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url
      ]);
    });

    it("contains properties of resources", async () => {
      var r = resource(testProjectDir),
          file1 = (await r.dirList())[0],
          {size, lastModified} = file1
      expect(+lastModified).greaterThan(Date.now() - 1000);
      expect(size).equals(7);
      expect((await r.dirList()).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url
      ]);
    });

    it("of directory recursively", async () => {
      var r = resource(testProjectDir);
      expect((await r.dirList('infinity')).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url,
        r.join("sub-dir/file2.js").url,
        r.join("sub-dir/sub-sub-dir/").url,
        r.join("sub-dir/sub-sub-dir/file3.js").url,
        r.join("sub-dir/sub-sub-dir/file4.txt").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file5.js").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

    it("recursively up to a depth", async () => {
      var r = resource(testProjectDir);
      expect((await r.dirList(2)).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url,
        r.join("sub-dir/file2.js").url,
        r.join("sub-dir/sub-sub-dir/").url
      ]);
    });

    it("list files with string filter", async () => {
      var r = resource(testProjectDir);
      expect((await r.dirList('infinity', {exclude: "sub-sub-dir"})).map(ea => ea.url)).deep.equals([
        r.join("file1.js").url,
        r.join("sub-dir/").url,
        r.join("sub-dir/file2.js").url
      ]);
    });

    it("list files with function filter", async () => {
      var r = resource(testProjectDir);
      expect((await r.dirList('infinity', {exclude: res => res.name().endsWith(".js")})).map(ea => ea.url)).deep.equals([
        r.join("sub-dir/").url,
        r.join("sub-dir/sub-sub-dir/").url,
        r.join("sub-dir/sub-sub-dir/file4.txt").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/").url,
        r.join("sub-dir/sub-sub-dir/sub-sub-sub-dir/file6.txt").url
      ]);
    });

  });
  
  describe("copying", () => {

    it("file to non-existing file", async () => {
      var r = resource(testProjectDir);
      await r.join("file1.js").copyTo(r.join("sub-dir/file3.js"));
      expect(await r.join("sub-dir/file3.js").read()).equals("foo bar");
    });

    it("file to existing file", async () => {
      var r = resource(testProjectDir);
      await r.join("file1.js").copyTo(r.join("sub-dir/file2.js"));
      expect(await r.join("sub-dir/file2.js").read()).equals("foo bar");
    });

    it("file to dir", async () => {
      var r = resource(testProjectDir);
      await r.join("file1.js").copyTo(r.join("sub-dir/"));
      expect(await r.join("sub-dir/file1.js").read()).equals("foo bar");
    });

    it("dir to dir", async () => {
      var r = resource(testProjectDir);
      await r.join("new-dir/").ensureExistance()
      await r.join("new-dir/sub-dir/").ensureExistance()
      await r.join("new-dir/foo.txt").ensureExistance("hello")
      await r.join("new-dir/sub-dir/bar.txt").ensureExistance("world")

      await r.join("new-dir/").copyTo(r.join("new-dir-2/"));

      expect((await r.join("new-dir-2/").dirList('infinity')).map(ea => ea.url)).deep.equals([
        r.join("new-dir-2/foo.txt").url,
        r.join("new-dir-2/sub-dir/").url,
        r.join("new-dir-2/sub-dir/bar.txt").url
      ]);
      expect(await r.join("new-dir-2/foo.txt").read()).equals("hello");
      expect(await r.join("new-dir-2/sub-dir/bar.txt").read()).equals("world");
    });

  });

});


describe("url operations", () => {

  it("is parent", () => {
    var r1 = resource("http://foo/bar/oink/baz.js"),
        r2 = resource("http://foo/bar/");
    expect(r1.isParentOf(r2)).equals(false);
    expect(r2.isParentOf(r1)).equals(true);
  });

  it("common directory", () => {
    var r1 = resource("http://foo/bar/oink/baz.js"),
        r2 = resource("http://foo/bar/zork.js"),
        r3 = resource("https://foo/bar/zork.js"),
        r4 = resource("http://foo/zork.js"),
        r5 = resource("http://foo");
    expect(r1.commonDirectory(r2).url).equals("http://foo/bar/");
    expect(r1.commonDirectory(r3)).equals(null);
    expect(r1.commonDirectory(r4).url).equals("http://foo/");
    expect(r1.commonDirectory(r5).url).equals("http://foo/");
  });


  it("remove relative parts", () => {
    expect(resource('http://foo.com/bar/../baz/').withRelativePartsResolved().url)
      .equals('http://foo.com/baz/');
  
    expect(resource('http://localhost/webwerkstatt/projects/HTML5/presentation100720/../../../').withRelativePartsResolved().url)
      .equals('http://localhost/webwerkstatt/');
  
    expect(resource('http://localhost/foo//bar').withRelativePartsResolved().url)
      .equals('http://localhost/foo/bar');
  
    expect(resource('http://localhost/foo/./bar').withRelativePartsResolved().url)
      .equals('http://localhost/foo/bar');
  });

  it("relative path from-to", () => {

    expect(resource("http://foo/bar/oink/baz.js").relativePathFrom(resource("http://foo/bar/")))
      .equals("oink/baz.js");
    expect(resource("http://foo/bar/oink/baz.js").relativePathFrom(resource("http://foo/bar/baz.js")))
      .equals("oink/baz.js");
    expect(resource("http://foo/bar/oink/baz.js").relativePathFrom(resource("http://foo/bar/zork/")))
      .equals("../oink/baz.js");

    expect(resource('http://www.foo.org/test/bar/baz')
      .relativePathFrom(resource('http://www.foo.org/')))
        .equals('test/bar/baz')

    // fixme subdomains?
    // expect(resource('http://www.foo.org/test/bar/baz')
    //   .relativePathFrom(resource('http://foo.org/')))
    //     .equals('test/bar/baz')

    expect(() => resource('http://foo.com/').relativePathFrom(resource('http://foo.org/')))
      .throws();

    var a = resource("http://northwestern.itsapirateslife.net:9001/core/lively/bootstrap.js"),
        b = resource("http://northwestern.itsapirateslife.net:9001//questions/Worlds/unknown_user_1434404507629_original.html?autosave=true");
    expect(a.relativePathFrom(b)).equals("../../core/lively/bootstrap.js")

    var a = resource('http://www.foo.org/bar/');
    expect(a.relativePathFrom(a)).equals("", "identity");
  });
  
  it("relativePathBetween", () => {

    expect(relativePathBetween("http://foo/bar/", "http://foo/bar/oink/baz.js"))
      .equals("oink/baz.js");
    expect(relativePathBetween("http://foo/bar/baz.js", "http://foo/bar/oink/baz.js"))
      .equals("oink/baz.js");
    expect(relativePathBetween("http://foo/bar/zork/", "http://foo/bar/oink/baz.js"))
      .equals("../oink/baz.js");

    expect(relativePathBetween('http://www.foo.org/', 'http://www.foo.org/test/bar/baz'))
        .equals('test/bar/baz')
    expect(relativePathBetween('http://www.foo.org', 'http://www.foo.org/test/bar/baz'))
        .equals('test/bar/baz')

    expect(() => relativePathBetween('http://foo.org/', 'http://foo.com/')).throws();

    var a = "http://northwestern.itsapirateslife.net:9001/core/lively/bootstrap.js",
        b = "http://northwestern.itsapirateslife.net:9001//questions/Worlds/unknown_user_1434404507629_original.html?autosave=true";
    expect(relativePathBetween(b, a)).equals("../../core/lively/bootstrap.js")

    expect(relativePathBetween('http://www.foo.org/bar/', 'http://www.foo.org/bar/')).equals("", "identity");
  });

});


describe("url queries", () => {

  it("read and set", () => {
    expect(resource("local://fooo?foo&bar=23").query()).deep.equals({bar: 23, foo: true});
    expect(resource("local://fooo").query()).deep.equals({});
    expect(resource("local://fooo").withQuery({bar: 23, foo: true}).url)
      .equals("local://fooo?bar=23&foo=true");
    expect(resource("local://fooo?baz=zork").withQuery({bar: 23, foo: true}).url)
      .equals("local://fooo?baz=zork&bar=23&foo=true");
  });

});

describe("extensions", () => {

  it("registers and unregisters resource extension", async () => {
    registerExtension({
      name: "test-resource",
      matches: url => url.startsWith("xxx:"),
      resourceClass: class extends Resource {
        async read() { return this.url.split(":")[1]; }
      }
    });
    expect(await resource("xxx:fooo").read()).equals("fooo");
    unregisterExtension("test-resource");
    expect(() => resource("xxx:fooo")).throws();
  });

});