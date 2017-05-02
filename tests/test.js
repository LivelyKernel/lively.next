/*global, describe,it,afterEach,beforeEach*/
import { expect } from "mocha-es6";
import {
  getInstalledPackage,
  addDependencyToPackage,
  installDependenciesOfPackage,
  buildPackageMap,
  installPackage
} from "../index.js";
import { tmpdir } from "os";
import { execSync, exec } from "child_process";
const { resource, createFiles } = lively.resources;


let baseDir = resource("local://lively.node-packages-test/"),
    baseDirFs = resource(`file://${tmpdir()}/lively.node-packages-test/`);


// await createFiles(resource("file:///Users/robert/temp"), {
//   "package-install-dir": {
//     foo: {
//       "package.json": JSON.stringify({
//         name: "foo",
//         version: "1.2.3",
//         dependencies: {"strip-ansi": "^2"}
//       })
//     }
//   }
// });

describe("package installation lookup", function() {

  this.timeout(10000);

  afterEach(() => baseDir.remove());

  describe("lookup", () => {

    it("reads installed package", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "foo@1.2.3": {"package.json": JSON.stringify({name: "foo", version: "1.2.3"})}
        }
      });
      let pMap = await buildPackageMap([baseDir.join("package-install-dir")]),
          pInfo = await getInstalledPackage("foo", "^1", pMap);
      expect(pInfo).containSubset({
        config: {name: "foo", version: "1.2.3"},
        location: baseDir.join("package-install-dir/foo@1.2.3/").url,
        scripts: undefined, bin: undefined
      });
    });


    it("looks up packages in multiple package dirs", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "a": {"foo@1.2.3": {"package.json": JSON.stringify({name: "foo", version: "1.2.3"})}},
          "b": {"bar@0.1.2": {"package.json": JSON.stringify({name: "bar", version: "0.1.2"})}}
        }
      });
      let pMap = await buildPackageMap([baseDir.join("package-install-dir/b"), baseDir.join("package-install-dir/a")]),
          pInfo1 = await getInstalledPackage("foo", "^1", pMap),
          pInfo2 = await getInstalledPackage("bar", null, pMap);
      expect(pInfo1).deep.property("config.name", "foo");
      expect(pInfo2).deep.property("config.name", "bar");
    });

  });

  describe("installation", () => {

    it("installs a package via npm", async () => {
      let {packageMap, newPackages} = await installPackage("strip-ansi@^3", baseDir.join("package-install-dir"));

      expect(packageMap).containSubset({
        "ansi-regex@2.1.1": {config: {name: "ansi-regex",version: "2.1.1",}},
        "strip-ansi@3.0.1": {config: {name: "strip-ansi"}}});

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

    it("installs all package deps", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "foo": {"package.json": JSON.stringify({name: "foo", version: "1.2.3", dependencies: {"strip-ansi@2.0.1": "^2"}})}
        }
      });
      let {packageMap, newPackages} = await installDependenciesOfPackage(baseDir.join("package-install-dir/foo"), baseDir.join("package-install-dir"));
      expect(newPackages.map(ea => ea.config.name)).equals(["strip-ansi", "ansi-regex"]);
      expect(packageMap).to.have.keys(["strip-ansi@2.0.1", "foo@1.2.3", "ansi-regex@1.1.1"]);
      expect((await baseDir.join("package-install-dir/").dirList()).map(ea => ea.name()))
        .equals(["foo", "strip-ansi@2.0.1", "ansi-regex@1.1.1"]);
    });

    it("add new dep", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "foo": {"package.json": JSON.stringify({name: "foo", version: "1.2.3"})}
        }
      });
      let {packageMap, newPackages} = await addDependencyToPackage(
        baseDir.join("package-install-dir/foo"),
        "strip-ansi@^2",
        baseDir.join("package-install-dir")
      );
        
      expect(await baseDir.join("package-install-dir/foo/package.json").readJson())
        .containSubset({dependencies: {"strip-ansi": "^2"}});
      expect(packageMap).to.have.keys(["strip-ansi@2.0.1", "foo@1.2.3", "ansi-regex@1.1.1"]);
    });

    
  });

  describe("resolving modules", () => {

    beforeEach(async () => {
      await baseDirFs.ensureExistance();
      await createFiles(baseDirFs, {
        "packages": {
          foo: {
            "package.json": JSON.stringify({name: "foo", version: "1.2.3"}),
            "index.js": "module.exports.x = 23"
          },
          bar: {
            "package.json": JSON.stringify({name: "bar", version: "0.1.0", dependencies: {foo: "*"}}),
            "index.js": "console.log(require('foo').x + 1);"
          }
        }
      });
    });

    afterEach(() => baseDirFs.remove());

    it("in node at startup", async () => {
      baseDirFs.join("packages/bar/").path();
      let resolverMod = resource(System.decanonicalize("flat-node-packages/module-resolver.js")).path(),
          out = execSync(`/Users/robert/.nvm/versions/node/v7.7.3/bin/node -r "${resolverMod}" -r './index.js'`, {
            env: {FNP_PACKAGE_DIRS: `${baseDirFs.join("packages/").path()}`},
            cwd: baseDirFs.join("packages/bar/").path()
          });
      expect(String(out).trim()).equals("24");
    });

  });
});

