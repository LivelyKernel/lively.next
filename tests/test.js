/*global, describe,it,afterEach,beforeEach,System,process*/
import { expect } from "mocha-es6";
import { tmpdir } from "./util.js";
import { join as j } from "path";
import { execSync, exec } from "child_process";
const { resource, createFiles } = lively.resources;

import {
  addDependencyToPackage,
  installDependenciesOfPackage,
  buildPackageMap,
  installPackage,
  buildPackage
} from "flatn/index.js"

import { PackageSpec } from "flatn/package-map.js"


/*
  Invocation from command line:
  eval `flatn_env`
  FLATN_PACKAGE_DIRS=deps mocha-es6 tests/test.js
*/


let baseDir = resource(`file://${tmpdir()}/lively.node-packages-test/`);


describe("flat packages", function() {

  this.timeout(20 * 1000);

  beforeEach(async () => {
    await baseDir.ensureExistance();
  });

  afterEach(() => baseDir.remove());

  describe("lookup", () => {

    it("reads installed package", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "test-package-1": {
            "1.2.3": { "package.json": JSON.stringify({ name: "test-package-1", version: "1.2.3" }) }
          }
        }
      });
      let pMap = buildPackageMap([baseDir.join("package-install-dir").path()]),
        pInfo = pMap.lookup("test-package-1", "^1");
      expect(pInfo).containSubset({
        name: "test-package-1",
        version: "1.2.3",
        location: baseDir.join("package-install-dir/test-package-1/1.2.3").path(),
        dependencies: undefined,
        devDependencies: undefined,
        scripts: undefined, bin: undefined,
        isDevPackage: false,
        versionInFileName: null,
        branch: null,
        flatn_package_dirs: undefined,
        gitURL: null,
      });
    });


    it("looks up packages in multiple package dirs", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "a": { "test-package-1": { "1.2.3": { "package.json": JSON.stringify({ name: "test-package-1", version: "1.2.3" }) } } },
          "b": { "test-package-2": { "0.1.2": { "package.json": JSON.stringify({ name: "test-package-2", version: "0.1.2" }) } } }
        }
      });
      let pMap = buildPackageMap([
        baseDir.join("package-install-dir/b").path(),
        baseDir.join("package-install-dir/a").path()
      ]),
        pInfo1 = pMap.lookup("test-package-1", "^1"),
        pInfo2 = pMap.lookup("test-package-2", null);
      expect(pInfo1).property("name", "test-package-1");
      expect(pInfo2).property("name", "test-package-2");
    });

    it("package config can specify lookup dir", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          a: {
            "test-package-1": {
              "1.2.3": {
                "package.json": JSON.stringify({
                  name: "test-package-1",
                  version: "1.2.3",
                  flatn_package_dirs: ["../../../b"]
                })
              }
            }
          },
          b: {
            "test-package-2": {
              "0.1.2": {
                "package.json": JSON.stringify({ name: "test-package-2", version: "0.1.2" })
              }
            }
          }
        }
      });
      let pMap = buildPackageMap([baseDir.join("package-install-dir/a").path()]),
        pInfo1 = pMap.lookup("test-package-1", "^1"),
        pInfo2 = pMap.lookup("test-package-2", null);
      expect(pInfo1).property("name", "test-package-1");
      expect(pInfo2).property("name", "test-package-2");
    });

  });

  describe("installation", () => {

    it("installs a package via npm", async () => {
      let basePath = baseDir.join("package-install-dir").path(),
        { packageMap, newPackages } = await installPackage("strip-ansi@^3", basePath);

      expect(packageMap.individualPackageDirs).equals([
        basePath + "/strip-ansi/3.0.1/",
        basePath + "/ansi-regex/2.1.1/"]);

      expect(packageMap.dependencyMap).containSubset({
        "ansi-regex@2.1.1": { name: "ansi-regex", version: "2.1.1", },
        "strip-ansi@3.0.1": { name: "strip-ansi" }
      });

      let installDir = baseDir.join("package-install-dir/strip-ansi/3.0.1/");
      expect().assert(await installDir.exists(), "strip-ansi does not exist");
      let files = (await installDir.dirList()).map(ea => ea.name());
      expect(files).equals([
        ".lv-npm-helper-info.json",
        "index.js",
        "license",
        "package.json",
        "readme.md"
      ]);

      expect(await installDir.join("package.json").readJson()).containSubset({
        "_from": "strip-ansi@>=3.0.0 <4.0.0",
        "_id": "strip-ansi@3.0.1"
      });
    });

    it("installs a package via git", async () => {
      await installPackage(
        "strip-ansi@https://github.com/chalk/strip-ansi#82707",
        baseDir.join("package-install-dir").path());
      let installDir = baseDir.join("package-install-dir/strip-ansi/https___github.com_chalk_strip-ansi_82707/");
      expect().assert(await installDir.exists(), installDir + " does not exist")
      let files = (await installDir.dirList()).map(ea => ea.name());
      expect(files).equals([
        ".editorconfig",
        ".git",
        ".gitattributes",
        ".gitignore",
        ".lv-npm-helper-info.json",
        ".travis.yml",
        "index.js",
        "license",
        "package.json",
        "readme.md",
        "test.js"
      ]);
    });

    it("installs all dependencies via npm", async () => {
      let installDir = baseDir.join("package-install-dir");
      await installPackage("mkdirp@0.5.1", installDir.path());
      let dirs = await baseDir.join("package-install-dir").dirList(2);
      expect(dirs.map(ea => ea.relativePathFrom(installDir)))
        .equals(["minimist/", "mkdirp/", "minimist/0.0.8/", "mkdirp/0.5.1/"]);
    });

    it("installs all dependencies via git and npm", async () => {
      let installDir = baseDir.join("package-install-dir");
      await installPackage("mkdirp@substack/node-mkdirp#f2003bb", installDir.path());
      let dirs = await baseDir.join("package-install-dir").dirList(2);
      expect(dirs.map(ea => ea.relativePathFrom(installDir))).equals([
        "minimist/",
        "mkdirp/",
        "minimist/0.0.8/",
        "mkdirp/https___github.com_substack_node-mkdirp_f2003bb/"
      ]);
    });

    it("installs all package deps", async () => {
      let installDir = baseDir.join("package-install-dir");
      await createFiles(baseDir, {
        "package-install-dir": {
          foo: {
            "package.json": JSON.stringify({
              name: "foo",
              version: "1.2.3",
              dependencies: { "strip-ansi": "^2" }
            })
          }
        }
      });
      let { packageMap, newPackages } =
        await installDependenciesOfPackage(installDir.join("foo").path());
      expect(newPackages.map(ea => ea.name)).equals(["strip-ansi", "ansi-regex"]);
      expect(packageMap.dependencyMap).to.have.keys(
        ["strip-ansi@2.0.1", "ansi-regex@1.1.1"]);
      let dirs = (await installDir.dirList(2)).map(ea => ea.relativePathFrom(installDir));
      expect(dirs).equals([
        "ansi-regex/",
        "foo/",
        "strip-ansi/",
        "ansi-regex/1.1.1/",
        "foo/package.json",
        "strip-ansi/2.0.1/"
      ]);
    });

    it("add new dep", async () => {
      await createFiles(baseDir, {
        "package-install-dir": {
          "foo": { "package.json": JSON.stringify({ name: "foo", version: "1.2.3" }) }
        }
      });
      let { packageMap, newPackages } = await addDependencyToPackage(
        baseDir.join("package-install-dir/foo").path(),
        "strip-ansi@^2",
        baseDir.join("package-install-dir").path(),
        undefined, undefined, true/*save*/);

      expect(await baseDir.join("package-install-dir/foo/package.json").readJson())
        .containSubset({ dependencies: { "strip-ansi": "^2" } });
      expect(packageMap.dependencyMap).to.have.keys(["strip-ansi@2.0.1", "ansi-regex@1.1.1"]);
    });

  });

  describe("building modules", () => {

    beforeEach(() =>
      createFiles(baseDir, {
        "build-test": {
          foo: {
            "1.2.3": {
              "package.json": JSON.stringify({
                name: "foo", version: "1.2.3",
                scripts: { install: "node install.js" },
                bin: { "foo-bin": "foo-bin" }
              }),
              "install.js": `require("fs").writeFileSync("./installed", "yes")`,
              "index.js": "module.exports.x = 23",
              "foo-bin": "#!/bin/bash\necho 'foo-bin!'"
            }
          },
          bar: {
            "0.1.0": {
              "package.json": JSON.stringify({
                name: "bar",
                version: "0.1.0",
                dependencies: { foo: "*" }
              }),
              "index.js": "console.log(require('foo').x + 1);",
            }
          }
        }
      }))

    it("runs install script", async () => {
      let pkg = PackageSpec.fromDir(baseDir.join("build-test/foo/1.2.3/").path());
      await buildPackage(pkg, buildPackageMap([], [pkg.location]));
      expect(await baseDir.join("build-test/foo/1.2.3/installed").read()).equals("yes");
    });

    it("runs install scripts of dependent packages", async () => {
      let pmap = buildPackageMap([baseDir.join("build-test/").path()])
      await buildPackage(PackageSpec.fromDir(baseDir.join("build-test/bar/0.1.0/").path()), pmap);
      expect(await baseDir.join("build-test/foo/1.2.3/installed").read()).equals("yes");
    });

    it("bins are linked", async () => {
      System._nodeRequire("fs").chmodSync(baseDir.join("build-test/foo/1.2.3/foo-bin").path(), "0755")
      let barDir = baseDir.join("build-test/bar/0.1.0/");
      let config = await barDir.join("package.json").readJson()
      config.scripts = { install: "node install-bar.js" };
      await barDir.join("package.json").writeJson(config);
      await barDir.join("install-bar.js").write(
        `require("fs").writeFileSync(
          "./installed",
          String(require("child_process").execSync("foo-bin")))`);
      let pmap = buildPackageMap([baseDir.join("build-test/").path()])
      await buildPackage(PackageSpec.fromDir(barDir.path()), pmap);
      expect(await barDir.join("installed").read()).equals("foo-bin!\n");
    });

  });

  describe("resolving modules", () => {

    beforeEach(async () => {
      await createFiles(baseDir, {
        "packages": {
          foo: {
            "1.2.3": {
              "package.json": JSON.stringify({ name: "foo", version: "1.2.3" }),
              "index.js": "module.exports.x = 23"
            }
          },
          bar: {
            "0.1.0": {
              "package.json": JSON.stringify({ name: "bar", version: "0.1.0", dependencies: { foo: "*" } }),
              "index.js": "console.log(require('foo').x + 1);"
            }
          }
        }
      })
    });

    it("in node at startup", async () => {
      let resolverMod = resource(System.decanonicalize("flatn/module-resolver.js")).path(),
        out = execSync(
          `${process.argv[0]} -r "${resolverMod}" -r './index.js'`,
          {
            env: {
              FLATN_PACKAGE_COLLECTION_DIRS: `${baseDir.join("packages/").path()}`,
              PATH: process.env.PATH
            },
            cwd: baseDir.join("packages/bar/0.1.0/").path()
          });
      expect(String(out).trim()).equals("24");
    });

    it("in node with own bin", async () => {
      let nodeBin = System.decanonicalize("flatn/bin/node").replace(/file:\/\//, ""),
        out = execSync(`${nodeBin} -r './index.js'`, {
          env: {
            PATH: process.env.PATH,
            FLATN_PACKAGE_COLLECTION_DIRS: `${baseDir.join("packages/").path()}`
          },
          cwd: baseDir.join("packages/bar/0.1.0/").path()
        });
      expect(String(out).trim()).equals("24");
    });

  });

  describe("dev packages", () => {

    beforeEach(async () => {

      await createFiles(baseDir, {
        "deps": {
          "test-package-1": {
            "1.2.3": {
              "package.json": JSON.stringify({
                name: "test-package-1",
                version: "1.2.3",
                dependencies: { "dev-package": "^0.1" },
                flatn_package_dirs: ["../../b"]
              })
            }
          }
        },
        "dev": {
          "dev-package": {
            "package.json": JSON.stringify({ name: "dev-package", version: "1.1.2" })
          }
        }
      });
    });

    it("lookup", async () => {
      let pMap = buildPackageMap(
        [baseDir.join("deps").path()], [],
        [baseDir.join("dev/dev-package").path()]),
        pInfo1 = pMap.lookup("test-package-1", "^1"),
        pInfo2 = pMap.lookup("dev-package", null);

      expect(pInfo1).property("name", "test-package-1");
      expect(pInfo2).property("name", "dev-package");
    });

    it("dev packages are used independent of version", async () => {
      let pMap = buildPackageMap(
        [baseDir.join("deps").path()], [],
        [baseDir.join("dev/dev-package").path()]);
      let { packageMap, newPackages } = await installDependenciesOfPackage(
        baseDir.join("deps/test-package-1/1.2.3").path(),
        baseDir.join("deps").path(),
        pMap
      );

      let depsDir = baseDir.join("deps");
      expect((await depsDir.dirList(2)).map(ea => ea.relativePathFrom(depsDir)))
        .equals(["test-package-1/", "test-package-1/1.2.3/"]);
      let devDir = baseDir.join("dev");
      expect((await devDir.dirList(2)).map(ea => ea.relativePathFrom(devDir)))
        .equals(["dev-package/", "dev-package/package.json"]);
    });

  });

});
