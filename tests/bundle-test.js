/*global declare, it, describe, beforeEach, afterEach, before, after,System*/
import { expect } from "mocha-es6";
import { createFiles, resource } from "lively.resources";
import FreezerPackage from "../package.js";
import Bundle from "../bundle.js";


function buildPackage1() {
  return createFiles(baseDir, {
    "package1": {
      "package.json": `{"name": "package1", "version": "1"}`,
      "file1.js": "import { x } from './file2.js'; export var y = x + 2;",
      "file2.js": "export var x = 23;"
    }
  });
}

async function createFiles(baseDir, fileSpec, opts) {
    let base = resource(baseDir, opts).asDirectory();
    await base.ensureExistance();
    for (let name in fileSpec) {
      if (!fileSpec.hasOwnProperty(name))
        continue;
      let resource = base.join(name);
      typeof fileSpec[name] === "object" ? await createFiles(resource, fileSpec[name], opts) : await resource.write(fileSpec[name]);
    }
    return base;
  }

let baseDir = resource("local://freezer-tests/");

describe("freezer bundle", function () {

  this.timeout(6000);

  afterEach(async () => {
    await baseDir.remove();
  });

  it("bundles simple package", async () => {
    await buildPackage1();
    let p  = new FreezerPackage("package1", null, baseDir.join("package1/"))
    await p.readConfig();
    let packages = {[p.qualifiedName]: p};
    
    let b = new Bundle(packages)
    await b.build("file1.js", "package1");

    expect(b.report().trim()).equals([
      `package1@1/file1.js`,
      `  => y`,
      `  <= package1@1/file2.js x`,
      ``,
      `package1@1/file2.js`,
      `  => x`
    ].join("\n"));
  });
});
