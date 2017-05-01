/*global, describe,it,afterEach,beforeEach*/
import { expect } from "mocha-es6";
import { getInstalledPackage, installPackage } from "../package-download.js";
import { resource } from "lively.resources";
import { createFiles } from "lively.resources";

let baseDir = resource("local://lively.node-packages-test/");

describe("package installation lookup", function() {

  this.timeout(10000);

  afterEach(() => baseDir.remove());

  it("reads installed package", async () => {
    await createFiles(baseDir, {
      "package-install-dir": {
        "foo@1.2.3": {"package.json": JSON.stringify({name: "foo", version: "1.2.3"})}
      }
    });
    let pInfo = await getInstalledPackage("foo", "^1", baseDir.join("package-install-dir"));
    expect(pInfo).containSubset({
      config: {name: "foo", version: "1.2.3"},
      location: baseDir.join("package-install-dir/foo@1.2.3/").url,
      scripts: undefined, bin: undefined
    });
  });

  it("installs a package via npm", async () => {
    await installPackage("strip-ansi@^3", baseDir.join("package-install-dir"));
    let installDir = baseDir.join("package-install-dir/strip-ansi@3.0.1/");
    expect().assert(await installDir.exists(), "strip-ansi does not exist")
    let files = (await installDir.dirList()).map(ea => ea.name());
    expect(files).equals(["index.js", "license", "package.json", "readme.md"]);
  });

  it("installs a package via git", async () => {
    await installPackage(
      "strip-ansi@https://github.com/chalk/strip-ansi#82707",
      baseDir.join("package-install-dir")
    );
    let installDir = baseDir.join("package-install-dir/strip-ansi@https___github.com_chalk_strip-ansi_82707/");
    expect().assert(await installDir.exists(), installDir + " does not exist")
    let files = (await installDir.dirList()).map(ea => ea.name());
    expect(files).equals([
      ".git",
      ".editorconfig",
      ".gitattributes",
      ".gitignore",
      ".travis.yml",
      "index.js",
      "license",
      "package.json",
      "readme.md",
      "test.js",
      ".lv-npm-helper-info.json"
    ]);
  });

  it("installs all dependencies via npm", async () => {
    await installPackage("mkdirp@0.5.1", baseDir.join("package-install-dir"));
    expect((await baseDir.join("package-install-dir").dirList()).map(ea => ea.name()))
      .equals(["mkdirp@0.5.1", "minimist@0.0.8"]);
  });

  it("installs all dependencies via git and npm", async () => {
    await installPackage("mkdirp@substack/node-mkdirp#f2003bb", baseDir.join("package-install-dir"));
    expect((await baseDir.join("package-install-dir").dirList()).map(ea => ea.name()))
      .equals(["mkdirp@https___github.com_substack_node-mkdirp_f2003bb", "minimist@0.0.8"]);
  });

});